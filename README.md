# snappergps-app

This repository contains the front-end and a (small) part of the back-end of [the SnapperGPS web application](https://snapper-gps.herokuapp.com/).

It is the companion app for your SnapperGPS receiver.
Use it to configure your SnapperGPS receiver for your next deployment
and to process the collected data after a completed deployment.

Find the remainder of the back-end in [the *snappergps-backend* repository](https://github.com/SnapperGPS/snappergps-backend/).

### Table of contents

  * [Technologies](#technologies)
  * [Repository structure](#repository-structure)
  * [Setting up a new SnapperGPS Heroku app](#setting-up-a-new-snappergps-heroku-app)
  * [Setting up a new SnapperGPS app without Heroku](#setting-up-a-new-snappergps-app-without-heroku)
  * [Database](#database)
  * [Files](#files)
  * [WebUSB messages](#webusb-messages)
  * [Offline mode](#offline-mode)
  * [Further notes](#further-notes)
  * [Acknowledgement](#acknowledgement)

## Technologies

The front-end is designed as [a Progressive Web App](https://web.dev/progressive-web-apps/)
and hence aims to combine the advantages of a web app and a native app.

The part of the back-end in this repository targets [the Node.js runtime](https://nodejs.org/)
and is intended to be hosted on [the Heroku cloud platform](https://www.heroku.com/),
although, the latter is not strictly necessary.
It stores data in [a PosgreSQL database](https://www.postgresql.org/).

Both parts are written in JavaScript.

The front-end communicates with your SnapperGPS receiver via [the WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/USB).
This allows for secure communication without the need to install a driver.
However, it requires a web browser and an operating system that support the WebUSB API.
Examples of browsers that currently (2022) support the WebUSB API are Microsoft Edge and Google Chrome.
Mozilla Firefox and Safari currently do not support the WebUSB API.
Examples of operating systems that currently support the WebUSB API are macOS, Microsoft Windows, and Linux operating systems like Android, Ubuntu, and Chrome OS.
iOS and iPadOS currently do not support the WebUSB API.

[A service worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) is present to enable the app to run offline, to keep the it up-to-date, and to serve push notifications.

## Repository structure

The JavaScript (and related content) for the back-end is split between the following files:

* The [`Procfile`](Procfile) that defines the command to start the app,
* The dependencies in [`package.json`](package.json),
* The entry point [`server.js`](server.js) that also connects to the database,
* Very few Heroku settings in [`settings.js`](settings.js),
* The routes to fulfil the user requests in [`routes.js`](routes.js), and
* Database functions in [`js/dbFunctions.js`](js/dbFunctions.js).

The directory [`views`](views) contains [Embedded JavaScript templates (EJS)](https://ejs.co/) that generate the individual views.
The most important ones are:

* [`views/index.ejs`](views/index.ejs) for the home page,
* [`views/configure.ejs`](views/configure.ejs) for configuration of a connected SnapperGPS receiver,
* [`views/upload.ejs`](views/upload.ejs) for uploading data from a connected SnapperGPS receiver to the cloud, and
* [`views/search.ejs`](views/search.ejs) and [`views/view.ejs`](views/view.ejs) for viewing processed data.

The sub-directory [`views/partials`](views/partials) contains elements that are used across different views.

Resources available to the user are stored in [`public`](public):

* Cascading style sheets in [`public/css`](public/css),
* Icons and photos in [`public/images`](public/images),
* JavaScript for the individual views in [`public/js`](public/js),
* Important functions that keep the app automatically up-to-date, enable it to run offline, and to make push notifications work in [`public/service-worker.js`](public/service-worker.js), and
* The web app manifest [`public/snappergps.webmanifest`](public/snappergps.webmanifest) that comprises all definitions to turn the SnapperGPS website into a PWA.

## Setting up a new SnapperGPS Heroku app

* Make sure that you have [git](https://git-scm.com) installed and configured.
* Open a terminal in a directory of your choice.
* Clone the SnapperGPS app repository via SSH ot HTTPS:
```shell
git clone git@github.com:SnapperGPS/snappergps-app.git
# or
git clone https://github.com/SnapperGPS/snappergps-app.git
```
* Change to the new directory:
```shell
cd snappergps-app
```
* Sign up for [a Heroku account](https://signup.heroku.com).
* Go to [your Heroku app dashboard](https://dashboard.heroku.com/apps).
* Select *New* and *Create new app*.
* Choose an app name, e.g., `my-snappergps-app`, and click *Create app*.
* Choose a deployment method. In the following, we will assume that you chose *Heroku Git*.
* [Download](https://devcenter.heroku.com/articles/heroku-command-line) and install the Heroku command line interface (CLI).
* Go back to your terminal and login to your Heroku account:
```shell
heroku login
```
* Add the Heroku app as a remote for the repository:
```shell
heroku git:remote -a my-snappergps-app
```
* To make the interactive maps on the upload view and the download view display properly, obtain [a Mapbox access token](https://docs.mapbox.com/help/getting-started/access-tokens/).
* Edit [public/js/upload/uploadUI.js](public/js/upload/uploadUI.js), [public/js/view/viewUI.js](public/js/view/viewUI.js), and [public/js/animate/animateUI.js](public/js/animate/animateUI.js) and set the variable `mapboxAccessToken` to your token.
* To make push notifications work, [generate a VAPID key pair for you email address](https://www.google.com/search?q=generate+vapid+key).
* Edit [public/js/upload/uploadUI.js](public/js/upload/uploadUI.js) and set the variable `vapidPublicKey` to your public key.
* Fill in your privacy policy in [views/privacy.ejs](views/privacy.ejs).
* Apply further desired changes to the source code of the SnapperGPS app.
* Stage, commit, and push (deploy) your changes:
```shell
git add public/js/upload/uploadUI.js public/js/view/viewUI.js my/changed.file
git commit -m "Change something"
git push heroku main
```
* If you want, visit your own SnapperGPS app on [https://my-snappergps-app.herokuapp.com](https://my-snappergps-app.herokuapp.com).
* Create [a Heroku Postgres](https://devcenter.heroku.com/articles/heroku-postgresql) SQL database using a Heroku plan, e.g., the free *hobby-dev* plan:
```shell
heroku addons:create heroku-postgresql:hobby-dev
```
* Obtain and note down the URL, the name, the user, and the password for the database from the following command, which returns a URL with the structure `postgres://database_user:database_password@database_url:port/database_name`:
```shell
heroku config
```
* Alternatively, you can connect an external PosgreSQL database instead of using one provisioned by Heroku:
```shell
heroku config:add DATABASE_URL=postgres://database_user:database_password@database_url:port/database_name
```
* In both cases, set up the database SQL schema using the provided file:
```shell
heroku pg:psql --file snappergps_db_schema.sql
```
* If you would now upload data via the app, it should appear in the database, which you can either verify by creating an SQL dataclip in the Heroku data center or with an SQL query from a local PosgreSQL client.
* Set up [the Python back-end](https://github.com/SnapperGPS/snappergps-backend).
* Enter the credentials of your database into the *config.py* file of the back-end.
* The app should now be fully functional.

## Setting up a new SnapperGPS app without Heroku

The SnapperGPS app can be set up on a server of your choice without using Heroku.
If you want to do so, pay attention to the following points:

* The server needs [the Node.js runtime](https://nodejs.org/) and [the NPM package manager](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) to serve the app.
* For a git-based deployment, it also needs [git](https://git-scm.com).
* You need to set up a PosgreSQL database and manually connect it to the app by setting `DATABASE_URL` to a URL with the structure `postgres://database_user:database_password@database_url:port/database_name`.
* The SnapperGPS app requires HTTPS.
* In general, follow the same steps as for a Heroku-hosted app.

## Database

The SQL file [`snappergps_db_schema.sql`](snappergps_db_schema.sql) describes the schema of the [PosgreSQL](https://www.postgresql.org/) database.
It consists of four tables:

* `uploads` has a single row for every user upload, either directly from a SnapperGPS receiver or from a file. It contains meta data like an upload timestamp `datetime`, the ID of the SnapperGPS receiver `device_id`, and the unique `upload_id` that identifies this upload. In addition, it optionally holds information to communicate the processing progress to the user, including an `email` address, a push notification `subscription`, and a Telegram `chat_id`. Finally, there is also data set by the processing back-end, e.g., the `status` of the processing.
* `snapshots` has a single row for each uploaded GNSS signal snapshot. Each row is identified by a unique `snapshot_id` and linked to an upload via an `upload_id`. Besides that each row holds a measurement timestamp `datetime` in UTC, the raw signal snapshot `data` where each bit represents an amplitude measurement and the bit-order is little, a `temperature` measurement from the MCU in degrees Celsius, and a `battery` voltage measurement in volts.
* `reference_points` has a single row for each user-provided starting point, described by latitude `lat` and longitude `lng` and linked to an upload via an `upload_id`.
* `positions` is populated by the processing back-end with position estimates consisting of `estimated_lat` and `estimated_lng` in decimal degrees. In addition, each row contains an `estimated_time_correction` in seconds and an uncertainty estimate `estimated_horizontal_error`. Each row is linked to a signal snapshot via a `snapshot_id`.

## Files

Instead of uploading data directly to the database, the users can choose to transfer the data from their SnapperGPS receiver to their host computer and store it in a local file. This is done via the *Upload* view, too. Two file formats are available. The legacy file format consisting of a CSV file with meta data and an individual binary file for each snapshot in a ZIP-compressed directory is described in [*snapshot-gnss-data*](https://github.com/JonasBchrt/snapshot-gnss-data). The alternative is a single (mostly) human-readable JSON file for a whole recording that contains a little bit of meta data (`deviceID`, `firmwareDescription`, `firmwareVersion`) and an array of individual GNSS signal `snapshots`. Each snapshot is defined by a measurement `timestamp` in UTC, a `temperature` measurement in degrees Celsius, a `batteryVoltage` measurement in volts, and the actual `data`. The latter are the raw signal amplitudes with one bit per value. The values are stored as byte stream where the bit order is little and which is encoded using [Base64](https://developer.mozilla.org/en-US/docs/Glossary/Base64).

## WebUSB messages

The SnapperGPS web app uses the WebUSB API to securely communicate with a SnapperGPS receiver.
The custom USB messages are defined in the readme of [*snappergps-firmware*](https://github.com/SnapperGPS/snappergps-firmware).

## Offline mode

Three views of the web app run offline: *Home*, *Configure*, and *Upload*. This is made possible by a service worker, which is defined in `public/service-worker.js`. When the user visits the homepage for the first time, then the service worker is registered. (You can check this in your browser's developer tools at Application -> Service Workers.) Once the worker is installed, it gets an `install` event and caches all the files that are listed in the respective function. Currently, these are all public files that are required to run the three views mentioned above offline. If you add or remove files used by these views, remember to change the file list of the service worker, too. If a user visits the page again, then the service worker intercepts any fetch request and provides the data from the cache if no network is available to enable an offline experience. If a network is available, it will attempt to update the cache. The development options allow you to simulate an offline experience, too, using the Network tab and the throttling options.

## Further notes

* If you want to run the app locally before you deploy it on a server (probably a good idea), then you can find information how to do it [here](https://devcenter.heroku.com/articles/getting-started-with-nodejs#run-the-app-locally). For this, you need Node.js and npm on your machine.
* If you add new resources (files) that shall be part of the offline version of the app, then make sure that the service worker caches them (see above).
* Note that the Python back-end is not part of this repository. To process snapshots that you have uploaded to the database, you need to run the script `process_queue.py`. This requires maintaining a local navigation database, which you can achieve with `maintain_navigation_data.py`. For more information, see the readme in [the respective repository](https://github.com/SnapperGPS/snappergps-backend).
* If you want to release the app in an app store such as Google Play or the Microsoft Store, then you can use the [PWA builder](https://www.pwabuilder.com/) to package it. Afterwards, follow [these instructions](https://github.com/pwa-builder/CloudAPK/blob/master/Next-steps.md) to publish it on Google Play or [these instructions](https://github.com/pwa-builder/pwabuilder-windows-chromium-docs/blob/master/next-steps.md) for the Microsoft Store.


## Acknowledgements

[Jonas Beuchert](https://users.ox.ac.uk/~kell5462/) and
[Alex Rogers](https://www.cs.ox.ac.uk/people/alex.rogers/)
are based
in the Department of Computer Science
of the University of Oxford.

Jonas Beuchert is
funded by the EPSRC Centre for Doctoral Training in
Autonomous Intelligent Machines and Systems
(University of Oxford Project Code: DFT00350-DF03.01, UKRI/EPSRC Grant Reference: EP/S024050/1)
and works on
SnapperGPS as part of his doctoral studies.
The implementation of SnapperGPS 
was co-funded by an EPSRC IAA Technology Fund
(D4D00010-BL14).

Parts of the SnapperGPS web app are based on work by [Peter Prince](https://github.com/pcprince).

##

This documentation is licensed under a
[Creative Commons Attribution 4.0 International License][cc-by].

[![CC BY 4.0][cc-by-image]][cc-by]

[cc-by]: http://creativecommons.org/licenses/by/4.0/
[cc-by-image]: https://i.creativecommons.org/l/by/4.0/88x31.png
