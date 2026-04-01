const path = require('path');
const fs = require('fs/promises');
const { tickets, ticketOptions, ticketDataFiles, staffRoleId } = require('./constants')
const { folderExists, fileExists } = require('../../lib/fsUtils');
const { json } = require('stream/consumers');
const ticketsDir = path.join(__dirname, '../../data/tickets');

async function initTicketFolder() {
    if (!(await folderExists(ticketsDir))) {
        await fs.mkdir(ticketsDir);
        console.log('cartella creata');
    }
    else console.log("cartella esistente");
}

async function initTicketData(){
    for(const dataFile of Object.values(ticketDataFiles)){
        if(!(await fileExists(dataFile))){
            await assignDefaultDataForFile();
            console.log('file creato:', dataFile);
        }
        else console.log("file eistente");
    }
}

async function assignDefaultDataForFile(){
    for(const dataFilePath of Object.values(ticketDataFiles)){
        dataFileName = dataFilePath.slice(15)
        if(dataFileName == 'ids.json') fs.writeFile(dataFilePath, JSON.stringify({"ticket_id": 0}, null, 4), 'utf8');
        else if(dataFileName == 'tickets.json') fs.writeFile(dataFilePath, JSON.stringify(
            {
                //TODO - implementare username di chi apre il ticket
                "ticket-user": {
                    "channel_id": null,
                    "message_id": null,
                    "user_id": null,
                    "claimed_by": null,
                    "closed_by": null,
                    "id" : 0,
                    "created_at": null,
                    "closed_at": null,
                    "reason": null,
                    "button_data" : {
                        "claim_button": false,
                        "close_with_reason_button": false
                    }
                }
            }, null, 4
        ));
        else if(dataFileName == 'persistent_data.json') fs.writeFile(dataFilePath, JSON.stringify(
            {
                "channel_id": null,
                "message_id": null
            }, null, 4
        ));
    }
}

initTicketFolder().catch(console.error);
initTicketData().catch(console.error)