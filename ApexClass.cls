public with sharing class EposMassUpdateController {
    @AuraEnabled(cacheable=false)
    public static String updateEposRecords(String csvData, List<String> selectedCheckboxes) {  
        system.debug('CSV IN APEX== '+csvData);
        try {	
            List<String> recordIdsToUpdate = csvData.split('\n');
            System.debug(recordIdsToUpdate.size());
            for(String str : recordIdsToUpdate){
                System.debug(str);
            }
            System.debug('SELECTED CHECK== '+selectedCheckboxes);
            
            List<PLN_Plan__c> eposRecords = [SELECT Id,Plan_Notification__c,Notification_Type__c,DOM_30__c,DOM_40__c,DOM_50__c FROM PLN_Plan__c WHERE Id IN :recordIdsToUpdate];
            system.debug('Records Retrived In Query '+eposRecords);
            
            for (PLN_Plan__c record : eposRecords) {
                record.Plan_Notification__c = true;
                record.Notification_Type__c='Modify';
                system.debug('Record BEFORE UPDATE  '+record);
                for(String checkboxValue: selectedCheckboxes){
                    if(checkboxValue=='DOM_30'){
                        record.DOM_30__c=true;
                        system.debug('DOM CHECK'+checkboxValue);
                        system.debug('DOM CH REC'+record.DOM_30__c);
                    }
                    else if(checkboxValue=='DOM_40'){
                        record.DOM_40__c=true;
                        system.debug('DOM CHECK'+checkboxValue);
                        system.debug('DOM CH REC'+record.DOM_40__c);
                    } else if(checkboxValue=='DOM_50'){
                        record.DOM_50__c=true;
                        system.debug('DOM CHECK'+checkboxValue);
                        system.debug('DOM CH REC'+record.DOM_50__c);
                    }
                }
            }
            Database.update(eposRecords.false);
            return 'Success';
        } catch (Exception e) {
            return 'Error: ' + e.getMessage();
        }
        
        
    }
    
    @AuraEnabled(cacheable=false)
    public static Map<String, List<String>> validateIds(List<String> ids) {
        List<String> validIds = new List<String>();
        List<String> invalidIds = new List<String>();
         system.debug('INCOMING IDS=='+ids);
        
        Set<String> allIdsSet = new Set<String>(ids);

        // Example with the Account object
        List<PLN_Plan__c> plans = [SELECT Id, IsDeleted FROM PLN_Plan__c WHERE Id IN :allIdsSet];
            system.debug('PLAN IDS in QUERY=='+plans);
        for (PLN_Plan__c acc : plans) {
            if (acc.IsDeleted) {
                invalidIds.add(acc.Id);
            } else {
                validIds.add(acc.Id);
            }
            allIdsSet.remove(acc.Id); // Remove queried IDs from the set
        }

        // The remaining IDs in the set are invalid
        invalidIds.addAll(allIdsSet);

        Map<String, List<String>> result = new Map<String, List<String>>();
        result.put('validIds', validIds);
        result.put('invalidIds', invalidIds);
        system.debug('VALID PLAN IDS=='+validIds);
        system.debug('INVALID PLAN IDS=='+invalidIds);
        return result;
    }
    
    
    
}
