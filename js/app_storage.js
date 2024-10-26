import * as constants from "./constants.js";

export const SOME_ID = "as1";
export const APP_EXT = "as2";
export const DIR_IN_CURRENT_DIR = "as3";
export const EXPORT = "as4";

export default class AppStorage {
    constructor(type, name = null, dirName = constants.CURRENT_DIR) {
        this.fileName = null;
        this.dirName = dirName;
        switch (type) {
            case SOME_ID:
                this.fileName = name + ".mtw";
                this.external = false;
                break;
            case APP_EXT:
                this.fileName = ".mtw";
                this.external = false;
                break;
            case DIR_IN_CURRENT_DIR:
                this.fileName = null;
                this.external = false;
                break;
            case constants.REPORT.SETTLE:
                this.fileName = "money_tail_transfer_to_settle.html"
                this.external = true;
                break;
            case constants.REPORT.ACC_TXN:
                this.fileName = "money_tail_account_transaction.html"
                this.external = true;
                break;
            case EXPORT:
                this.fileName = "money_tail_export.mtw";
                this.external = true;
                break;
            default:
                this.fileName = name;
                this.external = false;
        }
    }

    #canCreateDir() {
        if (this.dirName == constants.CURRENT_DIR) {
            return false;
        } else {
            return true;
        }
    }

    #getDeviceURL() {
        let url = null;
        if (cordova.platformId == "iOS") {
            url = this.external ?
                cordova.file.documentsDirectory :
                cordova.file.syncedDataDirectory;
        } else if (cordova.platformId == "android") {
            url = this.external ?
                "file:///storage/emulated/0/Download" :
                cordova.file.dataDirectory;
        } else {
            url = cordova.file.dataDirectory;
        }

        return url;
    }

    #writeTextToFileEntry(fileEntry, text, resolve, reject) {
        fileEntry.createWriter(
            (fileWriter) => {
                fileWriter.onwriteend = () => {
                    fileWriter.onwriteend = (event) => { resolve(event?.target?.localURL); }
                    fileWriter.onerror = (error) => { reject(error.message); };
                    let dataObj = new Blob([text], {type:'text/plain'});
                    fileWriter.write(dataObj);
                };
                fileWriter.onerror = (error) => { reject(error.message); };
                fileWriter.truncate(0);
            },
            (error) => {
                reject(error.message);
            });
    }

    #writeTextBrowser(text, resolve, reject) {
        window.requestFileSystem(
            LocalFileSystem.PERSISTENT,
            {},
            (fs) => {
                fs.root.getDirectory(
                    this.dirName,
                    { create: this.#canCreateDir() },
                    (dirEntry) => {
                        dirEntry.getFile(
                            this.fileName,
                            { create: true },
                            (fileEntry) => {
                                this.#writeTextToFileEntry(
                                    fileEntry, text, resolve, reject);
                            },
                            (error) => {
                                reject(error);
                            });

                    },
                    (error) => {
                        reject(error);
                    });
            },
            (error) => {
                reject(error);
            });
    }

    #writeTextOthers(text, resolve, reject) {
        window.resolveLocalFileSystemURL(
            this.#getDeviceURL(),
            (fs) => {
                fs.getDirectory(
                    this.dirName,
                    { create: this.#canCreateDir() },
                    (dirEntry) => {
                        dirEntry.getFile(
                            this.fileName,
                            { create: true },
                            (fileEntry) => {
                                this.#writeTextToFileEntry(
                                    fileEntry, text, resolve, reject);
                            },
                            (error) => {
                                reject(error);
                            });
                    },
                    (error) => {
                        reject(error);
                    });
            },
            (error) => {
                reject(error);
            });
    }

    writeText(text) {
        return new Promise((resolve, reject) => {
            if (cordova.platformId == "browser") {
                this.#writeTextBrowser(text, resolve, reject);
            } else {
                this.#writeTextOthers(text, resolve, reject);
            }
        });
    }

    writeTextSelect(text) {
        if (cordova.platformId == "browser") {
            return new Promise((resolve, reject) => {
                var file = new Blob([text], {type: "text/plain"});
                var a = document.createElement("a"),
                url = URL.createObjectURL(file);
                a.href = url;
                a.download = this.fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                resolve(this.fileName);
            });
        } else {
            let blob = new Blob([text], {type: "text/plain"});
            return cordova.plugins.saveDialog
                .saveFile(blob, this.fileName);  // this.fileName is suggested file name
        }
    }

    #readAsArrayBufferFromFileEntry(fileEntry, resolve, reject) {
        fileEntry.file(
            (file) => {
                let fileReader = new FileReader();
                fileReader.onloadend = () => { resolve(fileReader.result); };
                fileReader.onerror = (error) => { reject(error); };
                fileReader.readAsArrayBuffer(file);
            },
            (error) => {
                reject(error);
            });
    }

    #readAsArrayBufferBrowser(resolve, reject) {
        window.requestFileSystem(
            LocalFileSystem.PERSISTENT,
            {},
            (fs) => {
                fs.root.getDirectory(
                    this.dirName,
                    { create: false },
                    (dirEntry) => {
                        dirEntry.getFile(
                            this.fileName,
                            {},
                            (fileEntry) => {
                                this.#readAsArrayBufferFromFileEntry(
                                    fileEntry, resolve, reject);
                            },
                            (err) => {
                                if (err instanceof DOMException &&
                                        err.name == "NotFoundError") {
                                    reject(new FileError(FileError.NOT_FOUND_ERR));
                                } else {
                                    reject(err);
                                }
                            });
                    },
                    (error) => {
                        reject(error);
                    });
            },
            (error) => {
                reject(error);
            });
    }

    #readAsArrayBufferOthers(resolve, reject) {
        window.resolveLocalFileSystemURL(
            this.#getDeviceURL(),
            (fs) => {
                fs.getDirectory(
                    this.dirName,
                    { create: false },
                    (dirEntry) => {
                        dirEntry.getFile(
                            this.fileName,
                            {},
                            (fileEntry) => {
                                this.#readAsArrayBufferFromFileEntry(
                                    fileEntry, resolve, reject);
                            },
                            (err) => {
                                reject(err);
                            });
                    },
                    (error) => {
                        reject(error);
                    });
            },
            (error) => {
                reject(error);
            });
    }

    readAsArrayBuffer() {
        return new Promise((resolve, reject) => {
            if (cordova.platformId == "browser") {
                this.#readAsArrayBufferBrowser(resolve, reject);
            } else {
                this.#readAsArrayBufferOthers(resolve, reject);
            }
        });
    }

    #readTextFromFileEntry(fileEntry, resolve, reject) {
        fileEntry.file(
            (file) => {
                let fileReader = new FileReader();
                fileReader.onloadend = () => { resolve(fileReader.result); };
                fileReader.onerror = (error) => { reject(error); };
                fileReader.readAsText(file);
            },
            (error) => {
                reject(error);
            });
    }

    #readTextBrowser(resolve, reject) {
        window.requestFileSystem(
            LocalFileSystem.PERSISTENT,
            {},
            (fs) => {
                fs.root.getDirectory(
                    this.dirName,
                    { create: false },
                    (dirEntry) => {
                        dirEntry.getFile(
                            this.fileName,
                            {},
                            (fileEntry) => {
                                this.#readTextFromFileEntry(
                                    fileEntry, resolve, reject);
                            },
                            (err) => {
                                if (err instanceof DOMException &&
                                        err.name == "NotFoundError") {
                                    reject(new FileError(FileError.NOT_FOUND_ERR));
                                } else {
                                    reject(err);
                                }
                            });
                    },
                    (error) => {
                        reject(error);
                    });
            },
            (error) => {
                reject(error);
            });
    }

    #readTextOthers(resolve, reject) {
        window.resolveLocalFileSystemURL(
            this.#getDeviceURL(),
            (fs) => {
                fs.getDirectory(
                    this.dirName,
                    { create: false },
                    (dirEntry) => {
                        dirEntry.getFile(
                            this.fileName,
                            {},
                            (fileEntry) => {
                                this.#readTextFromFileEntry(
                                    fileEntry, resolve, reject);
                            },
                            (err) => {
                                reject(err);
                            });
                    },
                    (error) => {
                        reject(error);
                    });
            },
            (error) => {
                reject(error);
            });
    }

    readText() {
        return new Promise((resolve, reject) => {
            if (cordova.platformId == "browser") {
                this.#readTextBrowser(resolve, reject);
            } else {
                this.#readTextOthers(resolve, reject);
            }
        });
    }

    #deleteFileEntry(fileEntry, resolve, reject) {
        fileEntry.remove(
            (file) => { resolve(file); },
            (error) => { reject(error); });
    }

    #deleteFileBrowser(resolve, reject) {
        window.requestFileSystem(
            LocalFileSystem.PERSISTENT,
            {},
            (fs) => {
                fs.root.getDirectory(
                    this.dirName,
                    { create: false },
                    (dirEntry) => {
                        dirEntry.getFile(
                            this.fileName,
                            { create: false },
                            (fileEntry) => {
                                this.#deleteFileEntry(fileEntry, resolve, reject);
                            },
                            (error) => {
                                reject(error);
                            });
                    },
                    (error) => {
                        reject(error);
                    });
            },
            (error) => {
                reject(error);
            });
    }

    #deleteFileOthers(resolve, reject) {
        window.resolveLocalFileSystemURL(
            this.#getDeviceURL(),
            (fs) => {
                fs.getDirectory(
                    this.dirName,
                    { create: false },
                    (dirEntry) => {
                        dirEntry.getFile(
                            this.fileName,
                            { create: false },
                            (fileEntry) => {
                                this.#deleteFileEntry(fileEntry, resolve, reject);
                            },
                            (error) => {
                                reject(error);
                            });
                    },
                    (error) => {
                        reject(error);
                    });
            },
            (error) => {
                reject(error);
            });
    }

    deleteFile() {
        return new Promise((resolve, reject) => {
            if (cordova.platformId == "browser") {
                this.#deleteFileBrowser(resolve, reject);
            } else {
                this.#deleteFileOthers(resolve, reject);
            }
        });
    }

    #deleteDirRecursiveBrowser(resolve, reject) {
        window.requestFileSystem(
            LocalFileSystem.PERSISTENT,
            {},
            (fs) => {
                fs.root.getDirectory(
                    this.dirName,
                    { create: false },
                    (dirEntry) => {
                        dirEntry.removeRecursively(resolve, reject);
                    },
                    (error) => {
                        reject(error);
                    });
            },
            (error) => {
                reject(error);
            });
    }

    #deleteDirRecursiveOthers(resolve, reject) {
        window.resolveLocalFileSystemURL(
            this.#getDeviceURL(),
            (fs) => {
                fs.getDirectory(
                    this.dirName,
                    { create: false },
                    (dirEntry) => {
                        dirEntry.removeRecursively(resolve, reject);
                    },
                    (error) => {
                        reject(error);
                    });
            },
            (error) => {
                reject(error);
            });
    }

    deleteDirRecursive() {
        return new Promise((resolve, reject) => {
            if (cordova.platformId == "browser") {
                this.#deleteDirRecursiveBrowser(resolve, reject);
            } else {
                this.#deleteDirRecursiveOthers(resolve, reject);
            }
        });
    }

    #listFileEntries(reader, resolve, reject, fileCallback, doneCallback) {
        reader.readEntries((entries) => {
            if (entries.length == 0) {
                doneCallback();
                resolve();
                return;
            }

            entries.forEach((element, idx) => {
                if (element.isFile && element.name.endsWith(this.fileName)) {
                    element.file((f) => {
                        fileCallback(f);

                        if (idx == entries.length - 1) {
                            doneCallback();
                        }
                    });
                }
            });
            resolve();
        },
        (error) => {
            reject(error);
        })
    }

    #listFilesBrowser(resolve, reject, fileCallback, doneCallback) {
        window.requestFileSystem(
            LocalFileSystem.PERSISTENT,
            {},
            (fs) => {
                fs.root.getDirectory(
                    this.dirName,
                    { create: false },
                    (dirEntry) => {
                        var reader = dirEntry.createReader();
                        this.#listFileEntries(reader, resolve, reject, fileCallback, doneCallback);
                    },
                    (error) => {
                        reject(error);
                    });
            },
            (error) => {
                reject(error);
            });
    }

    #listFilesOthers(resolve, reject, fileCallback, doneCallback) {
        window.resolveLocalFileSystemURL(
            this.#getDeviceURL(),
            (fs) => {
                fs.getDirectory(
                    this.dirName,
                    { create: false },
                    (dirEntry) => {
                        var reader = dirEntry.createReader();
                        this.#listFileEntries(reader, resolve, reject, fileCallback, doneCallback);
                    },
                    (error) => {
                        reject(error);
                    });
            },
            (error) => {
                reject(error);
            });
    }

    listFiles(fileCallback, doneCallback) {
        return new Promise((resolve, reject) => {
            if (cordova.platformId == "browser") {
                this.#listFilesBrowser(resolve, reject, fileCallback, doneCallback);
            } else {
                this.#listFilesOthers(resolve, reject, fileCallback, doneCallback);
            }
        })
    }
}