/**
 * @Description       : This LWC accepts a CSV file with a header containing EPOS Ids only.
 *                    : Up to 10,000 record updates can be supported by this component in a single transaction.
 *                    : If there are any invalid, incorrect Ids, the component will generate an excel file 
 *                    : containing the invalid, incorrect Ids.
 * @Created Date      : 30-4-2024
 * @Author            : Vicky Madankar , Darshan Kukde             
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
 * Modifications Log 
 * Ver   Date         Author                              Modification
 * 1.0   05-8-2023   Vicky.Madankar@Perficient.com     Initial Version
**/
import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import updateEposRecords from '@salesforce/apex/p66_EposMassUpdateController.updateEposRecords';
import validateEposRecords from '@salesforce/apex/p66_EposMassUpdateController.validateEposRecords';
import { loadScript } from 'lightning/platformResourceLoader';
import sheetJS from '@salesforce/resourceUrl/p66_sheetJS';

export default class P66MassUpdateEpos extends LightningElement {
    isFileUploaded = false;
    @track data;
    @track fileName = '';
    @track showSpinner = false;
    selectedCheckboxes = [];
    filesUploaded = [];
    file;
    fileContents;
    fileReader;
    MAX_FILE_SIZE = 1500000;
    MAX_ROWS = 10000; // Maximum allowed rows including the header

    connectedCallback() {
        loadScript(this, sheetJS)
            .then(() => {
                console.log('Script Loaded Successfully');
            })
            .catch(error => {
                console.error('Error loading static resource', error);
            });
    }

    handleCheckboxChange(event) {
        const { name, checked } = event.target;
        if (checked) {
            this.selectedCheckboxes.push(name);
        } else {
            const index = this.selectedCheckboxes.indexOf(name);
            if (index !== -1) {
                this.selectedCheckboxes.splice(index, 1);
            }
        }
    }

    handleFilesChange(event) {
        if (event.target.files.length > 0) {
            const uploadedFile = event.target.files[0];
            const fileName = uploadedFile.name;
            const fileExtension = fileName.split('.').pop().toLowerCase();

            // Check if the file is a CSV
            if (fileExtension !== 'csv') {
                this.isFileUploaded = false;
                this.showToast('Error', 'Please upload a valid CSV file.', 'error', 'dismissable');
                return;
            }
            this.filesUploaded = event.target.files;
            this.fileName = event.target.files[0].name;
            this.isFileUploaded = true;
        }
    }

    handleSave() {
        if (this.filesUploaded.length > 0) {
            this.uploadHelper();
        } else {
            this.fileName = 'Please select a CSV file to upload!!';
        }
    }

    uploadHelper() {
        this.file = this.filesUploaded[0];
        if (this.file.size > this.MAX_FILE_SIZE) {
            this.showToast('Error', 'File Size is too large', 'error', 'sticky');
            return;
        }
        this.showSpinner = true;
        this.fileReader = new FileReader();
        this.fileReader.onloadend = (() => {
            const rows = this.fileReader.result.split('\n');
            if (rows.length > this.MAX_ROWS) {
                this.showSpinner = false;
                this.showToast('Error', 'The CSV file exceeds the maximum allowed rows of 10,000.', 'error', 'dismissable');
                return;
            }
            this.fileContents = this.modifyCSVData(this.fileReader.result);
            this.invalidFileHandler(this.fileContents.split('\n'));
        });
        this.fileReader.readAsText(this.file);
    }

    saveToFile(validIds) {
        updateEposRecords({ csvData: validIds, selectedCheckboxes: this.selectedCheckboxes })
            .then(result => {
                this.data = result;
                this.fileName = this.fileName + ' - Upload Successful';
                this.showSpinner = false;
                this.showToast('Success', 'Updated Successfully!!!', 'success', 'dismissable');
                this.isFileUploaded = false;
                setTimeout(() => {
                    window.location.reload();
                }, 2000);  // Refresh the window after 2 seconds
            })
            .catch(error => {
                this.showToast('Error', 'Failed to update EPOS records', 'error', 'sticky');
                this.showSpinner = false;
                setTimeout(() => {
                    window.location.reload();
                }, 2000);  // Refresh the window after 2 seconds
            });
    }

    invalidFileHandler(ids) {
        validateEposRecords({ ids: ids })
            .then(result => {
                const validIds = result.validIds;
                const invalidIds = result.invalidIds;
                if (invalidIds.length > 0) {
                    this.exportToExcel(invalidIds);
                    this.showToast('Error', 'Some IDs are invalid. Check the exported file for details.', 'error', 'dismissable');
                }

                if (validIds.length > 0) {
                    this.saveToFile(validIds.join('\n'));
                } else {
                    this.showSpinner = false;
                }
            })
            .catch(error => {
                this.showToast('Error', 'Failed to validate IDs', 'error', 'dismissable');
                this.showSpinner = false;
            });
    }

    // Function to Ignore Headers,double quotes and rest of the columns from CSV
    modifyCSVData(csvData) {
        const rows = csvData.split('\n');
        rows.shift();
        const modifiedRows = rows.map(row => {
            const columns = row.split(',');
            let id = columns[0].replace(/\r/g, '').trim();
            id = id.replace(/"/g, '');
            return this.convert15to18CharId(id);
        }).filter(row => row);
        return modifiedRows.join('\n');
    }

    // Function by Salesforce to Convert 15-character ID to 18-character ID
    convert15to18CharId(id) {
        if (id.length !== 15) {
            return id;
        }
        const suffix = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
        let addon = '';
        for (let block = 0; block < 3; block++) {
            let loop = 0;
            for (let position = 0; position < 5; position++) {
                const char = id.charAt(block * 5 + position);
                if (char >= 'A' && char <= 'Z') {
                    loop += 1 << position;
                }
            }
            addon += suffix.charAt(loop);
        }
        return id + addon;
    }

    // Function to export to Excel Invalid Ids if needed
    exportToExcel(invalidIds) {
        const hasIssues = invalidIds.length > 0;
        if (hasIssues) {
            const exportData = [['Invalid IDs']];
            invalidIds.forEach(id => {
                exportData.push([id]);
            });
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(exportData);
            XLSX.utils.book_append_sheet(wb, ws, 'Issues');
            try {
                XLSX.writeFile(wb, 'EPOS_Invalid_IDs_Report.xlsx');
            } catch (error) {
                console.error('Error in Exporting file', error);
            }
        }
    }


    showToast(title, message, variant, mode) {
        const toastEvent = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
            mode: mode
        });
        this.dispatchEvent(toastEvent);
    }
}