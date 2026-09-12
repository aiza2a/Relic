use super::models::GroupInfo;
use super::connection::with_connection;
use rusqlite::params;
use chrono;

const DEFAULT_GROUP_COLOR: &str = "#dc2626";
const DEFAULT_GROUP_ICON: &str = "ti ti-folder";

// 获取所有分组
pub fn get_all_groups() -> Result<Vec<GroupInfo>, String> {
    with_connection(|conn| {
        let mut groups = Vec::new();
        
        let mut stmt = conn.prepare("SELECT name, icon, color, order_index FROM groups ORDER BY order_index, name")?;
        let group_rows: Vec<(String, String, String, i32)> = stmt
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        
        drop(stmt);
        
        for (name, icon, color, order) in group_rows {
            let count: i32 = conn.query_row(
                "SELECT COUNT(*) FROM favorites WHERE group_name = ?1",
                params![&name],
                |row| row.get(0)
            )?;
            
            groups.push(GroupInfo {
                name,
                icon: normalize_group_icon(&icon),
                color: normalize_group_color(&color),
                order,
                item_count: count,
            });
        }
        
        Ok(groups)
    })
}

// 添加分组
pub fn add_group(name: String, icon: String, color: String) -> Result<GroupInfo, String> {
    with_connection(|conn| {
        let exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM groups WHERE name = ?1",
            params![&name],
            |row| row.get(0)
        )?;
        
        if exists > 0 {
            return Err(rusqlite::Error::InvalidParameterName(
                format!("分组 '{}' 已存在", name)
            ));
        }
        
        let max_order: Option<i32> = conn.query_row(
            "SELECT MAX(order_index) FROM groups",
            [],
            |row| row.get(0)
        ).ok().flatten();
        
        let new_order = max_order.unwrap_or(0) + 1;
        let now = chrono::Local::now().timestamp();
        let icon = normalize_group_icon(&icon);
        let color = normalize_group_color(&color);
        
        conn.execute(
            "INSERT INTO groups (name, icon, color, order_index, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&name, &icon, &color, new_order, now, now],
        )?;
        
        Ok(GroupInfo {
            name,
            icon,
            color,
            order: new_order,
            item_count: 0,
        })
    })
}

// 更新分组
pub fn update_group(old_name: String, new_name: String, new_icon: String, new_color: String) -> Result<GroupInfo, String> {
    with_connection(|conn| {
        if old_name != new_name {
            let exists: i64 = conn.query_row(
                "SELECT COUNT(*) FROM groups WHERE name = ?1",
                params![&new_name],
                |row| row.get(0)
            )?;
            
            if exists > 0 {
                return Err(rusqlite::Error::InvalidParameterName(
                    format!("分组 '{}' 已存在", new_name)
                ));
            }
        }
        
        let now = chrono::Local::now().timestamp();
        let new_icon = normalize_group_icon(&new_icon);
        let new_color = normalize_group_color(&new_color);
        let tx = conn.unchecked_transaction()?;
        
        tx.execute(
            "UPDATE groups SET name = ?1, icon = ?2, color = ?3, updated_at = ?4 WHERE name = ?5",
            params![&new_name, &new_icon, &new_color, now, &old_name],
        )?;
        
        if old_name != new_name {
            tx.execute(
                "UPDATE favorites SET group_name = ?1 WHERE group_name = ?2",
                params![&new_name, &old_name],
            )?;
        }
        
        tx.commit()?;
        
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM favorites WHERE group_name = ?1",
            params![&new_name],
            |row| row.get(0)
        )?;
        
        let (order, color): (i32, String) = conn.query_row(
            "SELECT order_index, color FROM groups WHERE name = ?1",
            params![&new_name],
            |row| Ok((row.get(0)?, row.get(1)?))
        )?;
        
        Ok(GroupInfo {
            name: new_name,
            icon: new_icon,
            color: normalize_group_color(&color),
            order,
            item_count: count,
        })
    })
}

// 删除分组
pub fn delete_group(name: String) -> Result<(), String> {
    with_connection(|conn| {
        if name == "全部" {
            return Err(rusqlite::Error::InvalidParameterName(
                "不能删除'全部'分组".to_string()
            ));
        }

        let tx = conn.unchecked_transaction()?;
        
        tx.execute(
            "UPDATE favorites SET group_name = '全部' WHERE group_name = ?1",
            params![&name],
        )?;
        
        tx.execute(
            "DELETE FROM groups WHERE name = ?1",
            params![&name],
        )?;
        
        tx.commit()?;
        Ok(())
    })
}

fn normalize_group_color(raw: &str) -> String {
    normalize_incoming_group_color(raw).unwrap_or_else(|| DEFAULT_GROUP_COLOR.to_string())
}

fn normalize_group_icon(raw: &str) -> String {
    let icon = raw.trim();
    if icon.is_empty() {
        DEFAULT_GROUP_ICON.to_string()
    } else {
        icon.to_string()
    }
}

fn normalize_incoming_group_color(raw: &str) -> Option<String> {
    let text = raw.trim();
    if text.is_empty() || text == "0" {
        return None;
    }

    if let Some(hex) = text.strip_prefix('#') {
        return normalize_hex_group_color(hex);
    }

    parse_numeric_group_color(text).map(rgb_to_hex)
}

fn normalize_hex_group_color(hex: &str) -> Option<String> {
    if !hex.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return None;
    }

    match hex.len() {
        3 => {
            let mut rgb = String::with_capacity(6);
            for ch in hex.chars() {
                rgb.push(ch);
                rgb.push(ch);
            }
            Some(format!("#{}", rgb.to_ascii_lowercase()))
        }
        6 => Some(format!("#{}", hex.to_ascii_lowercase())),
        8 => {
            let alpha = u8::from_str_radix(&hex[0..2], 16).ok()?;
            if alpha == 0 {
                return None;
            }
            Some(format!("#{}", hex[2..8].to_ascii_lowercase()))
        }
        _ => None,
    }
}

fn parse_numeric_group_color(text: &str) -> Option<u32> {
    let value = if let Some(hex) = text.strip_prefix("0x").or_else(|| text.strip_prefix("0X")) {
        i64::from_str_radix(hex, 16).ok()?
    } else {
        text.parse::<i64>().ok()?
    };

    let unsigned = value as u32;
    if unsigned == 0 {
        return None;
    }

    if unsigned <= 0x00ff_ffff {
        Some(unsigned)
    } else {
        let alpha = (unsigned >> 24) & 0xff;
        if alpha == 0 {
            None
        } else {
            Some(unsigned & 0x00ff_ffff)
        }
    }
}

fn rgb_to_hex(rgb: u32) -> String {
    format!("#{:06x}", rgb & 0x00ff_ffff)
}

#[cfg(test)]
mod tests {
    use super::{normalize_group_color, normalize_group_icon};

    #[test]
    fn normalizes_group_color_variants() {
        assert_eq!(normalize_group_color("#DC2626"), "#dc2626");
        assert_eq!(normalize_group_color("#f00"), "#ff0000");
        assert_eq!(normalize_group_color("#ff3b82f6"), "#3b82f6");
        assert_eq!(normalize_group_color("4282090230"), "#3b82f6");
        assert_eq!(normalize_group_color("-2349530"), "#dc2626");
        assert_eq!(normalize_group_color("0"), "#dc2626");
        assert_eq!(normalize_group_color("#003b82f6"), "#dc2626");
    }

    #[test]
    fn normalizes_empty_group_icon() {
        assert_eq!(normalize_group_icon(""), "ti ti-folder");
        assert_eq!(normalize_group_icon("   "), "ti ti-folder");
        assert_eq!(normalize_group_icon(" ti ti-star "), "ti ti-star");
    }
}

// 更新分组排序
pub fn reorder_groups(group_orders: Vec<(String, i32)>) -> Result<(), String> {
    with_connection(|conn| {
        let tx = conn.unchecked_transaction()?;
        let now = chrono::Local::now().timestamp();
        
        for (name, order) in group_orders {
            tx.execute(
                "UPDATE groups SET order_index = ?1, updated_at = ?2 WHERE name = ?3",
                params![order, now, &name],
            )?;
        }
        
        tx.commit()?;
        Ok(())
    })
}

