/****************************************************************************
 * searchUI.js
 * March 2021
 *****************************************************************************/

const idInput = document.getElementById('id-input');
const searchButton = document.getElementById('search-button');

const uploadTable = document.getElementById("upload-table");
const uploadTableRow = document.getElementById("upload-table-row");
const clearButton = document.getElementById("clear-button");

function searchId() {

    let id = idInput.value;

    if (id === '') {

        return;

    }

    // Remove all spaces as ID cannot contain them

    id = id.replace(' ', '');

    // Redirect to page which will contain upload information if it exists

    window.location.href = '/view?uploadid=' + id;

}

searchButton.addEventListener('click', searchId);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        searchId();
    }
});

clearButton.addEventListener('click', () => {

    // Clear "uploadIDs" in localStorage

    localStorage.removeItem('uploadData');

    // make table row invisible

    uploadTableRow.style.display = 'none';

});

// Call async function that displays upload IDs in table

displayUploadIDs();

// Display upload IDs in table

async function displayUploadIDs() {

    // Check if uploadIDs exist in localStorage, if it is an array, and if it has at least one element

    if (localStorage.getItem('uploadData') !== null &&
        Array.isArray(JSON.parse(localStorage.getItem('uploadData'))) &&
        JSON.parse(localStorage.getItem('uploadData')).length > 0) {

        // Make table row visible

        uploadTableRow.style.display = '';

        // Clear existing table

        uploadTable.innerHTML = '';

        // Add upload IDs to table
        
        JSON.parse(localStorage.getItem('uploadData')).forEach((upload) => {

            const tableRow = uploadTable.insertRow();
            const linkCell = tableRow.insertCell(0);
            linkCell.innerHTML = '<a class="text-link" href="/view?uploadid=' + upload[0] + '">' + upload[0] + '</a>';
            const nicknameCell = tableRow.insertCell(1);
            nicknameCell.textContent = upload[1];

        });

    }

}
