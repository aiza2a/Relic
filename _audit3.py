# -*- coding: utf-8 -*-
"""Deep audit: use-statement resolution, cargo manifest sanity, tauri config, workflow yaml."""
import io, os, re, json, glob

SEP = chr(92)
ROOT = 'src-tauri/src'
issues = []

# ---------- module tree ----------
files = {}
for dirpath, _, filenames in os.walk(ROOT):
    for fn in filenames:
        if fn.endswith('.rs'):
            p = os.path.join(dirpath, fn).replace(SEP, '/')
            files[p] = io.open(p, encoding='utf-8').read()

def module_file(crate_path):
    """crate::a::b -> candidate file paths; returns list of candidates where last segment may be item."""
    parts = crate_path.split('::')
    # walk from ROOT
    bases = ['']
    cur = ROOT
    ok = True
    for idx, part in enumerate(parts):
        f1 = cur + '/' + part + '.rs'
        f2 = cur + '/' + part + '/mod.rs'
        if f1 in files:
            cur = cur + '/' + part
            last_file = f1
        elif f2 in files:
            cur = cur + '/' + part
            last_file = f2
        else:
            return None, parts[-1] if idx > 0 else None, idx
    return cur, None, len(parts)

def resolve_use(path):
    """Return (resolved:bool, kind) for a crate:: path."""
    parts = path.split('::')
    cur = ROOT
    for idx, part in enumerate(parts):
        f1 = cur + '/' + part + '.rs'
        f2 = cur + '/' + part + '/mod.rs'
        if f1 in files or f2 in files:
            cur = f1 if f1 in files else f2
            continue
        # not a module: must be an item in module `cur`
        mod_rs = cur + '/mod.rs'
        mod_file = cur + '.rs'
        src = files.get(mod_rs) or files.get(mod_file)
        if src is None:
            return False
        # item re-exported via pub use X::*? check pub use lines and definitions
        if re.search(r'(pub\s+)?(fn|struct|enum|const|static|type|trait)\s+' + re.escape(part) + r'\b', src):
            return True
        # glob re-export: pub use xxx::*; -> recursively trust (rare)
        if re.search(r'pub use \w+::\*;', src):
            return True
        return False
    return True  # pure module path

for p, s in files.items():
    for m in re.finditer(r'^\s*use\s+(crate::[\w:]+)\s*(?: as|;|,|{)', s, re.M):
        path = m.group(1)
        if not resolve_use(path):
            issues.append(f'BROKEN USE: {p}: use {path}')

# ---------- Cargo.toml ----------
try:
    import tomllib
    cargo = tomllib.load(open('src-tauri/Cargo.toml', 'rb'))
    deps = set(cargo.get('dependencies', {}))
    deps |= set(cargo.get('dev-dependencies', {}))
    for target_deps in (cargo.get('target', {}) or {}).values():
        deps |= set(target_deps.get('dependencies', {}))
    print('cargo deps:', sorted(deps))
    # code-referenced crates must be in deps
    for p, s in files.items():
        for m in re.finditer(r'\b(use|extern crate)\s+([a-z_][a-z0-9_]*)', s):
            crate = m.group(2)
            if crate in ('crate', 'super', 'self'):
                continue
            # map crate names with dashes
            if crate not in deps and crate not in ('std', 'core', 'alloc'):
                if not any(d.replace('-', '_') == crate for d in deps):
                    issues.append(f'MISSING CRATE: {p}: {crate} (use {crate})')
except Exception as e:
    issues.append(f'CARGO PARSE FAIL: {e}')

# ---------- tauri.conf.json ----------
conf = json.load(open('src-tauri/tauri.conf.json', encoding='utf-8'))
caps = conf['app']['security']['capabilities']
for c in caps:
    if not os.path.exists(f'src-tauri/capabilities/{c}.json'):
        issues.append(f'MISSING CAPABILITY FILE: {c}')
for icon in conf['bundle']['icon']:
    if not os.path.exists('src-tauri/' + icon):
        issues.append(f'MISSING ICON: {icon}')
hooks = conf['bundle']['windows']['nsis'].get('installerHooks')
if hooks and not os.path.exists('src-tauri/' + hooks):
    issues.append(f'MISSING NSIS HOOK: {hooks}')
if 'updater' in json.dumps(conf):
    issues.append('TAURI CONF STILL REFERENCES UPDATER')
plugins_in_conf = set(conf.get('plugins', {}).keys())
print('conf plugins:', plugins_in_conf)

# capability permissions vs existing plugin crates
crate_names = {d.replace('tauri-plugin-', '') for d in deps if d.startswith('tauri-plugin-')}
allowed_prefixes = {'core'} | crate_names
for capfile in glob.glob('src-tauri/capabilities/*.json'):
    cd = json.load(open(capfile, encoding='utf-8'))
    for perm in cd.get('permissions', []):
        if isinstance(perm, str) and ':' in perm and not perm.startswith('core:'):
            prefix = perm.split(':')[0]
            if prefix in ('http', 'https'):  # http: scope keys
                prefix = 'http'
            if prefix not in allowed_prefixes:
                issues.append(f'STALE PERMISSION: {capfile}: {perm}')

# ---------- workflow yaml ----------
try:
    import yaml
    wf = yaml.safe_load(open('.github/workflows/ci.yml', encoding='utf-8'))
    print('workflow jobs:', list(wf['jobs'].keys()))
except ImportError:
    print('pyyaml missing, skip yaml parse')
except Exception as e:
    issues.append(f'WORKFLOW YAML ERROR: {e}')

# ---------- main.rs entry wiring ----------
main_src = files.get('src-tauri/src/main.rs', '')
lib_src = files.get('src-tauri/src/lib.rs', '')
for item in re.findall(r'relic_lib::(\w+)', main_src):
    if not re.search(r'pub\s+(?:fn|mod)\s+' + re.escape(item) + r'\b', lib_src):
        # maybe re-exported
        if f'pub use' not in lib_src or not re.search(item, lib_src):
            issues.append(f'MAIN->LIB MISSING: {item}')

print()
if issues:
    print('AUDIT ISSUES:', len(issues))
    for i in sorted(set(issues)):
        print(' -', i)
else:
    print('AUDIT CLEAN')
