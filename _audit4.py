# -*- coding: utf-8 -*-
"""Audit v4: correct use-statement resolution incl. glob re-exports and braces."""
import io, os, re

SEP = chr(92)
ROOT = 'src-tauri/src'
files = {}
for dirpath, _, filenames in os.walk(ROOT):
    for fn in filenames:
        if fn.endswith('.rs'):
            p = os.path.join(dirpath, fn).replace(SEP, '/')
            files[p] = io.open(p, encoding='utf-8').read()

issues = []

def module_dir(parts):
    """Walk module path parts; return dir of final module or None."""
    cur = ROOT
    for part in parts:
        f1 = cur + '/' + part + '.rs'
        f2 = cur + '/' + part + '/mod.rs'
        if f1 in files:
            cur = cur + '/' + part
        elif f2 in files:
            cur = cur + '/' + part
        else:
            return None
    return cur

def item_exists(dirpath, name, depth=0):
    """Check whether `name` is defined or re-exported in module at dirpath."""
    if depth > 4:
        return True  # give up trusting
    for cand in (dirpath + '/mod.rs', dirpath + '.rs'):
        src = files.get(cand)
        if src is None:
            continue
        if re.search(r'(pub\s+)?(fn|struct|enum|const|static|type|trait|mod)\s+' + re.escape(name) + r'\b', src):
            return True
        # explicit re-export: pub use path::name
        for m in re.finditer(r'^\s*pub\s+use\s+([\w:]+)::(\*|\{([^}]*)\}|(\w+))\s*;', src, re.M):
            if m.group(2) == name or (m.group(3) and name in [x.strip().split(' as ')[0] for x in m.group(3).split(',')]):
                target = m.group(1)
                if target == 'super':
                    super_dir = os.path.dirname(dirpath)
                    if item_exists(super_dir, name, depth + 1):
                        return True
                elif target == 'self':
                    continue
                elif target == 'crate':
                    if item_exists(ROOT, name, depth + 1):
                        return True
                else:
                    tdir = module_dir(target.split('::'))
                    if tdir and item_exists(tdir, name, depth + 1):
                        return True
        if re.search(r'pub use \w+::\*;', src):
            # glob: check each submodule file in this dir
            for sub in list(files):
                d = os.path.dirname(sub)
                if d == dirpath and sub != cand:
                    if re.search(r'(pub\s+)?(fn|struct|enum|const|static|type|trait)\s+' + re.escape(name) + r'\b', files[sub]):
                        return True
    return False

for p, s in files.items():
    for m in re.finditer(r'^\s*use\s+(crate::[\w:]+?)\s*(?: as\s+\w+|,|;|\{|$)', s, re.M):
        path = m.group(1)
        parts = [x for x in path.split('::') if x]
        d = module_dir(parts)
        if d is not None:
            continue  # pure module path
        # last segment is an item
        name = parts[-1]
        d2 = module_dir(parts[:-1])
        if d2 is None:
            issues.append(f'BROKEN USE PATH: {p}: {path}')
        elif not item_exists(d2, name):
            issues.append(f'MISSING ITEM: {p}: {path}')

# same class check for crate:: paths used inline (calls), sampled: crate::services / crate::windows / crate::commands tails
called = set()
for p, s in files.items():
    for m in re.finditer(r'crate::((?:services|windows|commands|utils|security|maintenance|startup_diagnostics)(?:::[a-z_0-9]+)+)', s):
        path = m.group(1)
        parts = [x for x in path.split('::') if x]
        if parts and parts[-1] in ('commands',):
            continue
        d = module_dir(parts)
        if d is not None:
            continue
        name = parts[-1]
        d2 = module_dir(parts[:-1])
        if d2 is None:
            issues.append(f'BROKEN INLINE PATH: {p}: crate::{path}')
        elif not item_exists(d2, name):
            issues.append(f'MISSING INLINE ITEM: {p}: crate::{path}')

uniq = sorted(set(issues))
print('USE/PATH ISSUES:', len(uniq))
for i in uniq[:40]:
    print(' -', i)
