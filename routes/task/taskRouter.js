const express = require('express');
const taskRouter = express.Router();
const taskDb = require('../../helpers/taskModel');
const notificationDb = require('../../helpers/notificationsModel');
const groupDb = require('../../helpers/groupModel');
const userDb = require('../../helpers/userModel');

const checkJwt = require('../../validators/checkJwt');
const checkUser = require('../../validators/checkUser');

const moment = require('moment');

var Pusher = require('pusher');

var pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    encrypted: true
  });

  const PushNotifications = require('@pusher/push-notifications-server');

  let beamsClient = new PushNotifications({
    instanceId: process.env.BEAMS_INSTANCE_ID,
    secretKey: process.env.BEAMS_SECRET_KEY
  });


  

  /****************************************************************************************************/
/** THIS ROUTER HANDLES ALL REQUESTS TO THE /api/task ENDPOINT **/
/****************************************************************************************************/

taskRouter.use(checkJwt);

/** ADD TASK
 * @TODO Add middleware to ensure user is logged in
 * /** Each time an task is added to a group, a notification should fire for that group's channel
         * Additionally, the event should be stored into the notifications table for future review
         * The notifications table will need to contain a record of the:
         *      userID
         *      groupID
         *      time of action
         *      type of action
         *      
         */
taskRouter.post('/', (req, res) => {
    const task = req.body;
    let groupID = task.groupID;

    taskDb.add(task).then(id => {
        // get group and user information for notification
        // we can assume the user in req.user is performing this action via checkJwt
        let notification = {};
        // can we abstract this into a function?
        userDb.getProfileByEmail(req.user.email).then(user => {
            notification.userID = user[0].id;
            notification.userName = user[0].name;

            groupDb.getById(groupID).then(group => {
                notification.groupID = group[0].id;
                notification.groupName = group[0].name;
                notification.action = 'add-task';
                notification.content = `${notification.userName} added ${task.name} to the ${notification.groupName} shopping list.`

                pusher.trigger(`group-${groupID}`, 'add-task', {
                    "message": `${notification.userName} added ${task.name} to the ${notification.groupName} shopping list.`,
                    "timestamp": moment().format()
                })

                beamsClient.publishToInterests([`group-${groupID}`], {
                    apns: {
                        aps: {
                            alert: notification.content
                        }
                    },
                    fcm: {
                        notification: {
                            title: `New Task Added`,
                            body: notification.content
                        }
                    }
                }).then((publishResponse) => {
                    console.log('task notification', publishResponse.publishId);
                }).catch((error) => {
                    console.log('error', error);
                })

                console.log('NOTIFICATION\n\n', notification);

                notificationDb.add(notification).then(response => {
                    console.log('notification added', response);
                    return res.status(200).json({message: `Task successfully added`, id: id[0]});
                })
            })
        }) 
    }).catch(err => {
        console.log(err);
        return res.status(500).json(err);
        })
})  
/**************************************************/

/** GET ITEM BY GROUP ID
 * @TODO Add middleware to ensure user is logged in
 * **/

/**************************************************/
taskRouter.get('/:id', (req, res) => {
    const id = req.params.id;

    taskDb.getById(id).then(task => {
        if (task.length >= 1) {
            return res.status(200).json({data: task})
        }

        return res.status(404).json({message: "The requested item does not exist."});
    })
        .catch(err => {
            const error = {
                message: `Internal Server Error - Retrieving Item`,
                data: {
                    err: err
                },
            }
            return res.status(500).json(error);
        })
})
/**************************************************/

// GET ALL ITEMS
/** @TODO This should be set to sysadmin privileges for subscription privacy **/

/**************************************************/

taskRouter.get('/', (req, res) => {
    taskDb.get().then(task => {
        if(task.length >= 1) {
            return res.status(200).json({data: task});
        }

        return res.status(404).json({message: `The requested items do not exist.`})
    })
        .catch(err => {
            const error = {
                message: `Internal Server Error - Getting Items`,
                data: {
                    err: err
                },
            }
            return res.status(500).json(error);
        })
})
/**************************************************/

// GET ALL ITEMS
/** @TODO This should be set to sysadmin privileges for subscription privacy **/

/**************************************************/

taskRouter.get('/', (req, res) => {
    taskDb.get().then(task => {
        if(task.length >= 1) {
            return res.status(200).json({data: task});
        }

        return res.status(404).json({message: `The requested items do not exist.`})
    })
        .catch(err => {
            const error = {
                message: `Internal Server Error - Getting Items`,
                data: {
                    err: err
                },
            }
            return res.status(500).json(error);
        })
})

/**************************************************/
/**
 * UPDATE ITEM
 * @TODO Add middleware to ensure users can only change their own group information
 */

/**************************************************/
taskRouter.put('/:id', (req, res) => {
    let id = req.params.id;
    let changes = req.body;
    // changes.price = parseFloat(changes.price);
    console.log('id, changes', id, changes);
    taskDb.getById(id).then(task => {
        let oldtask = task[0];// oldtask???

        taskDb.update(id, changes).then(status => {
            console.log('item update', status);

            if (status.length >= 1 || status === 1) {
                    let notification = {};
                    userDb.getProfileByEmail(req.user.email).then(user => {
                        notification.userID = user[0].id;
                        notification.userName = user[0].name;
        
                        taskDb.getById(id).then(newtask => {
                            let groupID = newtask[0].groupID;
        
                            groupDb.getById(groupID).then(group => {
                                notification.groupID = group[0].id;
                                notification.groupName = group[0].name;
                                notification.action = 'update-item';
                                notification.content = `${notification.userName} updated ${oldtask.name} to ${newtask[0].name} in the ${notification.groupName} shopping list.`
        
                                pusher.trigger(`group-${groupID}`, 'update-item', {
                                    "message": `${notification.userName} updated ${oldtask.name} to ${newtask[0].name} in the ${notification.groupName} shopping list.`,
                                    "timestamp": moment().format()
                                })

                                beamsClient.publishToInterests([`group-${groupID}`], {
                                    apns: {
                                        aps: {
                                            alert: notification.content
                                        }
                                    },
                                    fcm: {
                                        notification: {
                                            title: `Item Updated`,
                                            body: notification.content
                                        }
                                    }
                                }).then((publishResponse) => {
                                    console.log('item notification', publishResponse.publishId);
                                }).catch((error) => {
                                    console.log('error', error);
                                })
        
                                console.log('NOTIFICATION\n\n', notification);
        
                                notificationDb.add(notification).then(response => {
                                    console.log('notification added', response);
                                    return res.status(200).json({message: "Item updated successfully", id: status[0]})                                    
                                })
                            })
                        })
                    })
                } else {
                    return res.status(404).json({message: "The requested item does not exist."});
                }
        })
    })
        .catch(err => {
            const error = {
                message: `Internal Server Error - Updating Item`,
                data: {
                    err: err
                },
            }
            return res.status(500).json(error);
        })
})
/**************************************************/

/** DELETE ITEM
 * @TODO Add middleware to prevent unauthorized deletions
 * **/

/**************************************************/
taskRouter.delete('/:id', (req, res) => {
    const id = req.params.id;
    taskDb.getById(id).then(task => {
        let groupID = task[0].groupID;
        let oldtask = task[0];
        taskDb.remove(id).then(status => {
            console.log('remove status', status)
            if (status.length >= 1 || status === 1) {
                let notification = {};
                    userDb.getProfileByEmail(req.user.email).then(user => {
                        notification.userID = user[0].id;
                        notification.userName = user[0].name;
        
                            groupDb.getById(groupID).then(group => {
                                notification.groupID = group[0].id;
                                notification.groupName = group[0].name;
                                notification.action = 'delete-item';
                                notification.content = `${notification.userName} removed ${oldtask.name} from the ${notification.groupName} shopping list.`
        
                                pusher.trigger(`group-${groupID}`, 'delete-item', {
                                    "message": `${notification.userName} removed ${oldtask.name} from the ${notification.groupName} shopping list.`,
                                    "timestamp": moment().format()
                                })

                                beamsClient.publishToInterests([`group-${groupID}`], {
                                    apns: {
                                        aps: {
                                            alert: notification.content
                                        }
                                    },
                                    fcm: {
                                        notification: {
                                            title: `Item Deleted`,
                                            body: notification.content
                                        }
                                    }
                                }).then((publishResponse) => {
                                    console.log('item notification', publishResponse.publishId);
                                }).catch((error) => {
                                    console.log('error', error);
                                })
        
                                console.log('NOTIFICATION\n\n', notification);
        
                                notificationDb.add(notification).then(response => {
                                    console.log('notification added', response);
                                    return res.status(200).json({message: "Item removed successfully", id: status[0]})                               
                                })
                            })
                        })
            } else {
                return res.status(404).json({message: "The requested item does not exist."});
            }

        })
    })
            .catch(err => {
                const error = {
                    message: `Internal Server Error - Removing Item`,
                    data: {
                        err: err
                    },
                }
                return res.status(500).json(error);
            })
})


module.exports = taskRouter;
