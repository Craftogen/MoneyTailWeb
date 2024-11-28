export const MSG_INVALID = 0;
export const MSG_INIT = 1;
export const MSG_WORKBOOKS = 2;
export const MSG_NEW_WORKBOOK = 3;
export const MSG_EDIT_WORKBOOK = 4;
export const MSG_DUP_WORKBOOK = 5;
export const MSG_DEL_WORKBOOK = 6;
export const MSG_WORKSHEETS = 7;
export const MSG_NEW_WORKSHEET = 8;
export const MSG_EDIT_WORKSHEET = 9;
export const MSG_MOVE_WORKSHEET = 10;
export const MSG_COPY_WORKSHEET = 11;
export const MSG_DEL_WORKSHEET = 12;
export const MSG_WS_TRANSACTIONS = 13;
export const MSG_WS_UPDATE_TRANSACTIONS = 14;
export const MSG_NEW_SECTION = 15;
export const MSG_EDIT_SECTION = 16;
export const MSG_MOVE_SECTION = 17;
export const MSG_COPY_SECTION = 18;
export const MSG_DEL_SECTION = 19;
export const MSG_NEW_TRANSACTION = 20;
export const MSG_START_EDIT_TRANSACTION = 21;
export const MSG_EDIT_TRANSACTION = 22;
export const MSG_MOVE_TRANSACTION = 23;
export const MSG_COPY_TRANSACTION = 24;
export const MSG_DEL_TRANSACTION = 25;
export const MSG_ACCOUNTS = 26;
export const MSG_NEW_ACCOUNT = 27;
export const MSG_EDIT_ACCOUNT = 28;
export const MSG_DEL_ACCOUNT = 29;
export const MSG_LOAD_WORKBOOKS = 30;
export const MSG_LOAD = 31;
export const MSG_SAVE = 32;
export const MSG_SAVE_DEFAULT = 33;
export const MSG_IMPORT = 34;
export const MSG_EXPORT = 35;
export const MSG_REPORT = 36;
export const MSG_ERROR = 37;
export const MSG_SETTLE_REPORT_SETTINGS = 38;
export const MSG_AC_TXN_REPORT_SETTINGS = 39;

export const DEFAULT_WORKBOOK_ID = "wb0";
export const ME_ACCOUNT_ID = "a0";
export const ACCOUNTS_DATA = "accounts";
export const WORKBOOKS_DATA = "workbooks";
export const PREFS_DATA = "prefs";
export const CURRENT_DIR = ".";

export const ACTION = {
    NEW: "a1",
    EDIT: "a2",
    DUP: "a3"
}

export const REPORT = {
    SETTLE: "r1",
    ACC_TXN: "r2"
}

export const PREF_SECTIONS = {
    WORKBOOKS: 1001,
    WORKSHEETS: 1002,
    ACCOUNTS: 1003,
    WS_TXNS: 1004,
    AC_TXNS: 1005,
    SETTLE_REPORT: 1006,
    AC_TXN_REPORT: 1007
}

export const PREF_PROPERTY = {
    SORT_BY: 2001,
    SORT_TYPE: 2002,
    EXCLUDE_LIST: 2003
}