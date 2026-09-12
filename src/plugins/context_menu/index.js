import { invoke } from "@tauri-apps/api/core";
import { settingsStore } from "@shared/store/settingsStore";

document.addEventListener("contextmenu", (event) => event.preventDefault());

const MENU_ITEM_TYPE = {
  ITEM: "item",
  SEPARATOR: "separator",
  BUTTON_ROW: "button_row",
};

function valueOrNull(value) {
  return value === undefined ? null : value;
}

function normalizeButton(button = {}) {
  return {
    id: String(button.id ?? ""),
    label: String(button.label ?? ""),
    icon: button.icon ?? null,
    favicon: button.favicon ?? null,
    iconColor: button.iconColor ?? null,
    disabled: Boolean(button.disabled),
  };
}

function normalizeMenuItem(item = {}) {
  const type = item.type ?? MENU_ITEM_TYPE.ITEM;

  if (type === MENU_ITEM_TYPE.SEPARATOR) {
    return createSeparator();
  }

  if (type === MENU_ITEM_TYPE.BUTTON_ROW) {
    return createButtonRow({
      id: item.id ?? "",
      label: item.label ?? "",
      buttons: Array.isArray(item.buttons) ? item.buttons : [],
      disabled: item.disabled,
    });
  }

  return createMenuItem({
    id: item.id,
    label: item.label,
    icon: item.icon,
    favicon: item.favicon,
    iconColor: item.iconColor,
    disabled: item.disabled,
    checked: item.checked,
    children: Array.isArray(item.children)
      ? item.children.map(normalizeMenuItem)
      : null,
    previewImage: item.previewImage,
  });
}

export function getQuickClipboardMenuAppearance(overrides = {}) {
  return {
    theme: valueOrNull(overrides.theme ?? settingsStore.theme),
    lightThemeStyle: valueOrNull(
      overrides.lightThemeStyle ?? settingsStore.lightThemeStyle,
    ),
    darkThemeStyle: valueOrNull(
      overrides.darkThemeStyle ?? settingsStore.darkThemeStyle,
    ),
    uiAnimationEnabled:
      overrides.uiAnimationEnabled ?? settingsStore.uiAnimationEnabled ?? true,
    customFontEnabled: valueOrNull(
      overrides.customFontEnabled ?? settingsStore.customFontEnabled,
    ),
    customFontType: valueOrNull(
      overrides.customFontType ?? settingsStore.customFontType,
    ),
    customFontPath: valueOrNull(
      overrides.customFontPath ?? settingsStore.customFontPath,
    ),
    customFontUrl: valueOrNull(
      overrides.customFontUrl ?? settingsStore.customFontUrl,
    ),
    customFontFamily: valueOrNull(
      overrides.customFontFamily ?? settingsStore.customFontFamily,
    ),
  };
}

export function createMenuPlacementFromEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  return { anchor: "cursor" };
}

export function createCursorMenuPlacement() {
  return { anchor: "cursor" };
}

export function createPhysicalMenuPlacement(x, y) {
  return {
    anchor: "point",
    coordinateSpace: "physical",
    x: Math.round(x),
    y: Math.round(y),
  };
}

function normalizeRequest(request = {}) {
  return {
    items: Array.isArray(request.items)
      ? request.items.map(normalizeMenuItem)
      : [],
    placement: request.placement ?? createCursorMenuPlacement(),
    appearance: getQuickClipboardMenuAppearance(request.appearance ?? {}),
    behavior: {
      isTrayMenu: Boolean(request.behavior?.isTrayMenu),
      forceFocus: Boolean(request.behavior?.forceFocus),
    },
    layout: {
      width: request.layout?.width ?? null,
    },
  };
}

export async function showContextMenu(request) {
  try {
    return await invoke("show_context_menu", {
      request: normalizeRequest(request),
    });
  } catch (error) {
    console.error("显示右键菜单失败:", error);
    return null;
  }
}

export function createMenuItem({
  id,
  label,
  icon = null,
  favicon = null,
  iconColor = null,
  disabled = false,
  checked = false,
  children = null,
  previewImage = null,
}) {
  return {
    type: MENU_ITEM_TYPE.ITEM,
    id: String(id ?? ""),
    label: String(label ?? ""),
    icon: checked ? "ti ti-check" : icon,
    favicon,
    iconColor,
    disabled: Boolean(disabled),
    children,
    previewImage,
  };
}

export function createButtonRow({
  id,
  label = "",
  buttons = [],
  disabled = false,
}) {
  return {
    type: MENU_ITEM_TYPE.BUTTON_ROW,
    id: String(id ?? ""),
    label: String(label ?? ""),
    buttons: buttons.map(normalizeButton),
    disabled: Boolean(disabled),
  };
}

export function createSeparator() {
  return { type: MENU_ITEM_TYPE.SEPARATOR };
}

export async function closeAllContextMenus() {
  try {
    await invoke("close_all_context_menus");
  } catch (error) {
    console.error("关闭右键菜单失败:", error);
  }
}
