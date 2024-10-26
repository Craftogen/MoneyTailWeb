import * as constants from "./constants.js";
import * as main_w from "./../wasm/main.js";
import * as common from "./common.js";

let wasm = null;
let moneyTail = null;

function update_workbooks(obj, prefs) {
    let wb_prefs = prefs[constants.PREF_SECTIONS.WORKBOOKS];
    obj.postMessage([
        constants.MSG_WORKBOOKS,
        moneyTail.get_workbooks(
            wb_prefs[constants.PREF_PROPERTY.SORT_BY],
            wb_prefs[constants.PREF_PROPERTY.SORT_TYPE])]);
}

function update_worksheets(obj, wb_id, prefs) {
    if (wb_id && wb_id != "") {
        let ws_prefs = prefs[constants.PREF_SECTIONS.WORKSHEETS];
        obj.postMessage([
            constants.MSG_WORKSHEETS,
            moneyTail.get_worksheets(
                wb_id,
                ws_prefs[constants.PREF_PROPERTY.SORT_BY],
                ws_prefs[constants.PREF_PROPERTY.SORT_TYPE])]);
    }
}

function update_worksheet_transactions(obj, unified_ws_id, prefs) {
    if (unified_ws_id && unified_ws_id != "") {
        let ws_txn_prefs = prefs[constants.PREF_SECTIONS.WS_TXNS];
        let data = moneyTail.get_worksheet_transactions(
            unified_ws_id,
            ws_txn_prefs[constants.PREF_PROPERTY.SORT_BY],
            ws_txn_prefs[constants.PREF_PROPERTY.SORT_TYPE]);
        obj.postMessage([constants.MSG_WS_TRANSACTIONS, data]);
    }
}

function update_accounts(obj, prefs) {
    let ac_prefs = prefs[constants.PREF_SECTIONS.ACCOUNTS];
    obj.postMessage([
        constants.MSG_ACCOUNTS,
        moneyTail.get_accounts(
            ac_prefs[constants.PREF_PROPERTY.SORT_BY],
            ac_prefs[constants.PREF_PROPERTY.SORT_TYPE])]);
}

function save_worksheet(obj, unified_ws_id) {
    const [wb_id, ws_id] = common.ununify_id(unified_ws_id);
    obj.postMessage([
        constants.MSG_SAVE,
        moneyTail.export_worksheet(unified_ws_id),
        ws_id,  // save file named <ws_id>.mtw
        wb_id]);  // save to dir <wb_id>
}

function delete_worksheet(obj, unified_ws_id) {
    const [wb_id, ws_id] = common.ununify_id(unified_ws_id);
    obj.postMessage([
        constants.MSG_DEL_WORKSHEET,
        ws_id,  // delete file named <ws_id>.mtw
        wb_id]);  // delete from dir <wb_id>
}

function save_workbook(obj, wb_id) {
    const data_obj = JSON.parse(
        moneyTail.get_worksheets(
            wb_id,
            main_w.SortBy.Nothing, main_w.SortType.Unsorted));
    for (let i = 0; i < data_obj.length; i++) {
        save_worksheet(obj, data_obj[i][0]);
    }
}

function save_workbook_names(obj) {
    obj.postMessage([
        constants.MSG_SAVE,
        moneyTail.export_workbook_names(),
        constants.WORKBOOKS_DATA,
        constants.CURRENT_DIR]);
}

function save_accounts(obj) {
    obj.postMessage([
        constants.MSG_SAVE,
        moneyTail.export_accounts(),
        constants.ACCOUNTS_DATA,
        constants.CURRENT_DIR]);
}

function save_all(obj) {
    const wb_data = moneyTail.export_workbook_names();
    const wb_obj = JSON.parse(wb_data);
    for (const [wb_id, _] of Object.entries(wb_obj["workbooks"])) {
        save_workbook(obj, wb_id);
    }

    obj.postMessage([
        constants.MSG_SAVE,
        wb_data,
        constants.WORKBOOKS_DATA,
        constants.CURRENT_DIR]);

    save_accounts(obj);
}

function into_worksheet(
        obj, msg_id, from_unified_ws_id, to_wb_id, prefs) {
    try {
        let new_unified_ws_id = (msg_id == constants.MSG_MOVE_WORKSHEET)
            ? moneyTail.move_worksheet(from_unified_ws_id, to_wb_id)
            : moneyTail.copy_worksheet(from_unified_ws_id, to_wb_id);

        save_worksheet(obj, new_unified_ws_id);
        update_worksheets(obj, new_unified_ws_id, prefs);

        if (msg_id == constants.MSG_MOVE_WORKSHEET) {
            delete_worksheet(obj, from_unified_ws_id);
        }

        obj.postMessage([msg_id]);
    } catch (err_str) {
        obj.postMessage([constants.MSG_ERROR, err_str]);
    }
}

function into_section(
        obj, msg_id, from_unified_s_id, to_unified_ws_id, prefs) {
    try {
        (msg_id == constants.MSG_MOVE_SECTION)
            ? moneyTail.move_section(from_unified_s_id, to_unified_ws_id)
            : moneyTail.copy_section(from_unified_s_id, to_unified_ws_id);

        save_worksheet(obj, to_unified_ws_id);

        if (msg_id == constants.MSG_MOVE_SECTION &&
            (common.worksheet_id_from_transaction_id(from_unified_s_id) !=
                common.worksheet_id_from_transaction_id(to_unified_ws_id))) {
            // Save worksheet moved from if moved from & to are different
            save_worksheet(obj, from_unified_s_id);
        }

        update_worksheet_transactions(obj, to_unified_ws_id, prefs);
        obj.postMessage([msg_id]);
    } catch (err_str) {
        obj.postMessage([constants.MSG_ERROR, err_str]);
    }
}

function into_transaction(
        obj, msg_id, from_unified_t_id, to_unified_s_id, prefs) {
    try {
        (msg_id == constants.MSG_MOVE_TRANSACTION)
            ? moneyTail.move_transaction(from_unified_t_id, to_unified_s_id)
            : moneyTail.copy_transaction(from_unified_t_id, to_unified_s_id);

        save_worksheet(obj, to_unified_s_id);

        if (msg_id == constants.MSG_MOVE_TRANSACTION &&
            (common.worksheet_id_from_transaction_id(from_unified_t_id) !=
                common.worksheet_id_from_transaction_id(to_unified_s_id))) {
            // Save worksheet moved from if moved from & to are different
            save_worksheet(this, unified_t_id);
        }

        update_worksheet_transactions(obj, to_unified_s_id, prefs);
        obj.postMessage([msg_id]);
    } catch(err_str) {
        obj.postMessage([constants.MSG_ERROR, err_str]);
    }
}

onmessage = function(e) {
    let ret = "";
    let wb_id = null;
    let unified_ws_id = null;
    let unified_s_id = null;
    let unified_t_id = null;
    let ac_id = null;
    let name = null;
    let prefs = null;

    let msg_id = e.data[0];
    switch (msg_id) {
        case constants.MSG_INIT:
            wasm = main_w.initSync(e.data[1]);
            if (wasm) {
                moneyTail = new main_w.MoneyTail();
            }
            this.postMessage([constants.MSG_INIT]);
            break;

        case constants.MSG_WORKBOOKS:
            update_workbooks(this, e.data[1]);
            break;

        case constants.MSG_NEW_WORKBOOK:
            try  {
                name = e.data[1];
                wb_id = moneyTail.add_new_workbook(name);
                prefs = e.data[2];
                save_workbook(this, wb_id);
                save_workbook_names(this);
                update_workbooks(this, prefs);
                this.postMessage([constants.MSG_NEW_WORKBOOK]);
            } catch(err_str) {
                this.postMessage([constants.MSG_ERROR, err_str]);
            }
            break;

        case constants.MSG_EDIT_WORKBOOK:
            try {
                wb_id = e.data[1];
                name = e.data[2];
                prefs = e.data[3];
                ret = moneyTail.edit_workbook(wb_id, name);
                save_workbook_names(this);
                update_workbooks(this, prefs);
                this.postMessage([constants.MSG_EDIT_WORKBOOK]);
            } catch(err_str) {
                this.postMessage([constants.MSG_ERROR, ret]);
            }
            break;

        case constants.MSG_DUP_WORKBOOK:
            try {
                wb_id = e.data[1];
                name = e.data[2];
                prefs = e.data[3];
                wb_id = moneyTail.duplicate_workbook(wb_id, name);
                save_workbook(this, wb_id);
                save_workbook_names(this);
                update_workbooks(this, prefs);
                this.postMessage([constants.MSG_DUP_WORKBOOK]);
            } catch(err_str) {
                this.postMessage([constants.MSG_ERROR, err_str]);
            }
            break;

        case constants.MSG_DEL_WORKBOOK:
            wb_id = e.data[1];
            prefs = e.data[2];
            ret = moneyTail.delete_workbook(wb_id);
            if (ret == "") {
                save_workbook_names(this);
                update_workbooks(this, prefs);
                this.postMessage([constants.MSG_DEL_WORKBOOK, wb_id]);
            } else {
                this.postMessage([constants.MSG_ERROR, ret]);
            }
            break;

        case constants.MSG_WORKSHEETS:
            wb_id = e.data[1];
            prefs = e.data[2];
            update_worksheets(this, wb_id, prefs);
            break;

        case constants.MSG_NEW_WORKSHEET:
            try  {
                wb_id = e.data[1];
                name = e.data[2];
                prefs = e.data[3];
                unified_ws_id = moneyTail.add_new_worksheet(wb_id, name);
                save_worksheet(this, unified_ws_id);
                update_worksheets(this, wb_id, prefs);
                this.postMessage([constants.MSG_NEW_WORKSHEET]);
            }
            catch(err_str) {
                this.postMessage([constants.MSG_ERROR, err_str]);
            }
            break;

        case constants.MSG_EDIT_WORKSHEET:
            unified_ws_id = e.data[1];
            name = e.data[2];
            prefs = e.data[3];
            ret = moneyTail.edit_worksheet(unified_ws_id, name);
            if (ret == "") {
                save_worksheet(this, unified_ws_id);
                update_worksheets(this, unified_ws_id, prefs);
                this.postMessage([constants.MSG_EDIT_WORKSHEET]);
            } else {
                this.postMessage([constants.MSG_ERROR, ret]);
            }
            break;

        case constants.MSG_DEL_WORKSHEET:
            unified_ws_id = e.data[1];
            prefs = e.data[2];
            ret = moneyTail.delete_worksheet(unified_ws_id);
            if (ret == "") {
                update_worksheets(this, unified_ws_id, prefs);
                delete_worksheet(this, unified_ws_id);
            } else {
                this.postMessage([constants.MSG_ERROR, ret]);
            }
            break;

        case constants.MSG_COPY_WORKSHEET:
            into_worksheet(this, msg_id, e.data[1], e.data[2], e.data[3]);
            break;

        case constants.MSG_MOVE_WORKSHEET:
            into_worksheet(this, msg_id, e.data[1], e.data[2], e.data[3]);
            break;

        case constants.MSG_WS_TRANSACTIONS:
            unified_ws_id = e.data[1];
            prefs = e.data[2];
            update_worksheet_transactions(this, unified_ws_id, prefs);
            break;

        case constants.MSG_NEW_SECTION:
            unified_ws_id = e.data[1];
            name = e.data[2];
            prefs = e.data[3]
            try {
                let id = moneyTail.add_new_section(unified_ws_id, name);
                save_worksheet(this, unified_ws_id);
                update_worksheet_transactions(this, unified_ws_id, prefs);
                this.postMessage([constants.MSG_NEW_SECTION, id])
            } catch(err_str) {
                this.postMessage([constants.MSG_ERROR, err_str]);
            }
            break;

        case constants.MSG_EDIT_SECTION:
            unified_s_id = e.data[1];
            name = e.data[2];
            prefs = e.data[3];
            try {
                let id_name = moneyTail.edit_section(unified_s_id, name);
                save_worksheet(this, unified_s_id);
                update_worksheet_transactions(this, unified_s_id, prefs);
                this.postMessage([
                    constants.MSG_EDIT_SECTION,
                    id_name.id,
                    id_name.name]);
            } catch(err_str) {
                this.postMessage([constants.MSG_ERROR, err_str]);
            }
            break;

        case constants.MSG_DEL_SECTION:
            unified_s_id = e.data[1];
            prefs = e.data[2];
            ret = moneyTail.delete_section(unified_s_id);
            if (ret == "") {
                save_worksheet(this, unified_s_id);
                update_worksheet_transactions(this, unified_s_id, prefs);
                this.postMessage([constants.MSG_DEL_SECTION]);
            } else {
                this.postMessage([constants.MSG_ERROR, ret]);
            }
            break;

        case constants.MSG_COPY_SECTION:
            into_section(this, msg_id, e.data[1], e.data[2], e.data[3]);
            break;

        case constants.MSG_MOVE_SECTION:
            into_section(this, msg_id, e.data[1], e.data[2], e.data[3]);
            break;

        case constants.MSG_COPY_SECTION:
            unified_s_id = e.data[1];   // Copy section from
            unified_ws_id = e.data[2];  // Copy worksheet to
            prefs = e.data[3];
            ret = moneyTail.copy_section(unified_s_id, unified_ws_id);
            if (ret == "") {
                save_worksheet(this, unified_ws_id);
                update_worksheet_transactions(this, unified_ws_id, prefs);
                this.postMessage([constants.MSG_MOVE_SECTION]);
            } else {
                this.postMessage([constants.MSG_ERROR, ret]);
            }
            break;

        case constants.MSG_NEW_TRANSACTION:
            unified_s_id = e.data[1];
            ac_id = e.data[7];
            prefs = e.data[8];
            try {
                moneyTail.add_new_transaction(
                    unified_s_id,
                    e.data[2],          // date
                    e.data[3],          // desc
                    e.data[4],          // from_account
                    e.data[5],          // to_account
                    e.data[6]);         // amount
                save_worksheet(this, unified_s_id);
                update_worksheet_transactions(this, unified_s_id, prefs);
                this.postMessage([constants.MSG_NEW_TRANSACTION]);
            } catch (err_str) {
                this.postMessage([constants.MSG_ERROR, err_str]);
            }
            break;

        case constants.MSG_EDIT_TRANSACTION:
            unified_t_id = e.data[1];
            ac_id = e.data[7];
            prefs = e.data[8];
            try {
                moneyTail.edit_transaction(
                    unified_t_id,
                    e.data[2],          // date
                    e.data[3],          // desc
                    e.data[4],          // from_account
                    e.data[5],          // to_account
                    e.data[6]);         // amount
                save_worksheet(this, unified_t_id);
                update_worksheet_transactions(this, unified_t_id, prefs);
                this.postMessage([constants.MSG_EDIT_TRANSACTION]);
            } catch (err_str) {
                this.postMessage([constants.MSG_ERROR, err_str]);
            }
            break;

        case constants.MSG_START_EDIT_TRANSACTION:
            unified_t_id = e.data[1];
            this.postMessage([
                constants.MSG_START_EDIT_TRANSACTION,
                moneyTail.get_transaction(unified_t_id),
                unified_t_id]);
            break;

        case constants.MSG_DEL_TRANSACTION:
            unified_t_id = e.data[1];
            prefs = e.data[2];
            ret = moneyTail.delete_transaction(unified_t_id);
            if (ret == "") {
                save_worksheet(this, unified_t_id);
                update_worksheet_transactions(this, unified_t_id, prefs);
                this.postMessage([constants.MSG_DEL_TRANSACTION]);
            } else {
                this.postMessage([constants.MSG_ERROR, ret]);
            }
            break;

        case constants.MSG_COPY_TRANSACTION:
            into_transaction(this, msg_id, e.data[1], e.data[2], e.data[3]);
            break;

        case constants.MSG_MOVE_TRANSACTION:
            into_transaction(this, msg_id, e.data[1], e.data[2], e.data[3]);
            break;

        case constants.MSG_ACCOUNTS:
            let ac_prefs = e.data[1][constants.PREF_SECTIONS.ACCOUNTS];
            this.postMessage([
                constants.MSG_ACCOUNTS,
                moneyTail.get_accounts(
                    ac_prefs[constants.PREF_PROPERTY.SORT_BY],
                    ac_prefs[constants.PREF_PROPERTY.SORT_TYPE])]);
            break;

        case constants.MSG_NEW_ACCOUNT:
            name = e.data[1];
            prefs = e.data[2];
            try {
                moneyTail.add_new_account(name);
                save_accounts(this);
                update_accounts(this, prefs);
                this.postMessage([constants.MSG_NEW_ACCOUNT]);
            } catch (err_str) {
                this.postMessage([constants.MSG_ERROR, err_str]);
            }
            break;

        case constants.MSG_EDIT_ACCOUNT:
            ac_id = e.data[1];
            unified_ws_id = e.data[2];
            name = e.data[3];
            prefs = e.data[4];
            ret = moneyTail.edit_account(ac_id, name);
            if (ret == "") {
                save_accounts(this);
                update_accounts(this, prefs);
                this.postMessage([constants.MSG_EDIT_ACCOUNT]);
            } else {
                this.postMessage([constants.MSG_ERROR, ret]);
            }
            break;

        case constants.MSG_DEL_ACCOUNT:
            ret = moneyTail.delete_account(e.data[1]);
            if (ret == "") {
                save_accounts(this);
                update_accounts(this, e.data[2]);
                this.postMessage([constants.MSG_DEL_ACCOUNT]);
            } else {
                this.postMessage([constants.MSG_ERROR, ret]);
            }
            break;

        case constants.MSG_LOAD_WORKBOOKS:
            ret = moneyTail.import(new Uint8Array(e.data[1]));
            if (ret == "") {
                this.postMessage([
                    constants.MSG_LOAD_WORKBOOKS,
                    moneyTail.get_workbooks(
                        main_w.SortBy.Nothing, main_w.SortType.Unsorted)]);
            } else {
                this.postMessage([
                    constants.MSG_ERROR,
                    "Load failed\n\n" + ret]);
            }

        case constants.MSG_LOAD:
            ret = moneyTail.import(new Uint8Array(e.data[1]));
            if (ret != "") {
                this.postMessage([
                    constants.MSG_ERROR,
                    "Load failed\n\n" + ret]);
            }
            break;

        case constants.MSG_SAVE_DEFAULT:
            moneyTail.default_if_empty();
            save_all(this);
            update_workbooks(this, e.data[1]);
            update_accounts(this, e.data[1]);
            break;

        case constants.MSG_IMPORT:
            unified_t_id = e.data[1];
            prefs = e.data[2];
            let data = e.data[3];
            ret = moneyTail.import(new Uint8Array(data));
            if (ret == "") {
                save_all(this);
                update_workbooks(this, prefs);
                update_worksheets(this, unified_t_id, prefs);
                update_worksheet_transactions(this, unified_t_id, prefs);
                update_accounts(this, prefs);
                this.postMessage([
                    constants.MSG_IMPORT]);
            } else {
                this.postMessage([
                    constants.MSG_ERROR,
                    "Import failed\n\n" + ret]);
            }
            break;

        case constants.MSG_EXPORT:
            this.postMessage([
                constants.MSG_EXPORT,
                moneyTail.export_all()])
            break;

        case constants.MSG_REPORT:
            ret = "";
            switch (e.data[1]) {
                case constants.REPORT.SETTLE:
                    ret = moneyTail.generate_settle_report(e.data[2], true);
                    break;
                case constants.REPORT.ACC_TXN:
                    ret = moneyTail.generate_acc_txn_report(e.data[2], true);
                    break;
                default:
                    this.postMessage([constants.MSG_ERROR,
                        "Invalid report type"]);
            }
            if (ret != "") {
                this.postMessage([constants.MSG_REPORT, ret, e.data[1]]);
            } else {
                this.postMessage([
                    constants.MSG_ERROR,
                    "Unexpected error generating report"]);
            }
            break;

        case constants.MSG_SETTLE_REPORT_SETTINGS:
            this.postMessage([
                constants.MSG_SETTLE_REPORT_SETTINGS,
                moneyTail.get_workbooks(
                    main_w.SortBy.Name,
                    main_w.SortType.Ascending)]);
            break;

        case constants.MSG_AC_TXN_REPORT_SETTINGS:
            this.postMessage([
                constants.MSG_AC_TXN_REPORT_SETTINGS,
                moneyTail.get_workbooks(
                    main_w.SortBy.Name,
                    main_w.SortType.Ascending)]);
            break;
    }
}
