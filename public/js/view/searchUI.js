/****************************************************************************
 * searchUI.js
 * March 2021
 *****************************************************************************/

const idInput = document.getElementById('id-input');
const searchButton = document.getElementById('search-button');

searchButton.addEventListener('click', () => {

    let id = idInput.value;

    if (id === '') {

        return;

    }

    // Remove all spaces as ID cannot contain them

    id = id.replace(' ', '');

    // Redirect to page which will contain upload information if it exists

    window.location.href = '/view?uploadid=' + id;

});
