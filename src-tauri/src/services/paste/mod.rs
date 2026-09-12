pub mod paste_handler;
pub mod options;
pub mod text;
pub mod keyboard;
pub mod clipboard_content;
pub mod merge;

pub use options::PasteAction;
pub use clipboard_content::{
    FilesData, 
    set_clipboard_from_item, set_clipboard_text, set_clipboard_files,
};
pub use merge::{copy_merged_items, paste_merged_items};








