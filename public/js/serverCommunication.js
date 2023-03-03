/****************************************************************************
 * serverCommunication.js
 * March 2021
 *****************************************************************************/

/* global XMLHttpRequest */

/**
 * Send a POST request to the given route, sending a data packet
 * @param {string} route Route name
 * @param {object} data FormData object to be sent with POST message
 * @param {function} callback Function to run on completion, returning either the response or false
 */
function sendPOSTRequest(route, data, callback) {

    var xmlHttp = new XMLHttpRequest();

    xmlHttp.onreadystatechange = () => {

        if (xmlHttp.readyState === 4) {

            if (xmlHttp.status === 200) {

                if (callback) {

                    callback(xmlHttp.responseText);

                }

            } else if (xmlHttp.status === 400) {

                console.error(xmlHttp.responseText);

                if (callback) {

                    callback(false);

                }

            }

        }

    };

    xmlHttp.open('POST', '/' + route, true);
    xmlHttp.send(data);

}
