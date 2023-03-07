/****************************************************************************
 * searchUI.js
 * March 2021
 *****************************************************************************/

const idInput = document.getElementById('id-input');
const searchButton = document.getElementById('search-button');

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
