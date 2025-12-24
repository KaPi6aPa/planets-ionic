// addPlanetModal.js

// модалка
const addPlanetModal = document.querySelector('ion-modal[trigger="add-planet-modal"]');
// кнопки
const closeModalButton = addPlanetModal?.querySelector('#close-add-planet-modal');
const confirmAddPlanetButton = addPlanetModal?.querySelector('#confirm-add-planet');

if (!addPlanetModal || !closeModalButton || !confirmAddPlanetButton) {
  console.warn('Модальне вікно додавання планети не знайдено в DOM.');
} else {
  // закрити
  closeModalButton.addEventListener('click', async () => {
    await addPlanetModal.dismiss();
  });

  // додати
  confirmAddPlanetButton.addEventListener('click', async () => {
    const nameInput = addPlanetModal.querySelector('#planetName');
    const imageInput = addPlanetModal.querySelector('#planetImage');
    const descriptionInput = addPlanetModal.querySelector('#planetDescription');
    const temperatureInput = addPlanetModal.querySelector('#planetTemperature');
    const massInput = addPlanetModal.querySelector('#planetMass');
    const atmosphereInput = addPlanetModal.querySelector('#planetAtmosphere');
    const satellitesInput = addPlanetModal.querySelector('#planetSatellites');
    const missionsInput = addPlanetModal.querySelector('#planetMissions');

    const newPlanet = {
      name: nameInput.value.trim(),
      image: imageInput.value.trim(),
      description: descriptionInput.value.trim(),
      details: {
        temperature: temperatureInput.value.trim(),
        mass: massInput.value.trim(),
        atmosphere: atmosphereInput.value.trim(),
        satellites: satellitesInput.value
          ? satellitesInput.value.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        missions: missionsInput.value
          ? missionsInput.value.split(',').map((m) => m.trim()).filter(Boolean)
          : [],
      },
    };

    // обовʼязкові поля
    if (!newPlanet.name || !newPlanet.image || !newPlanet.description) {
      alert("Будь ласка, заповніть всі обов'язкові поля (назва, зображення, опис).");
      return;
    }

    try {
      const raw = localStorage.getItem('planets');
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        arr.push(newPlanet);
        localStorage.setItem('planets', JSON.stringify(arr));
      } else {
        localStorage.setItem('planets', JSON.stringify([newPlanet]));
      }
    } catch (e) {
      console.error('Помилка запису в localStorage:', e);
    }

    // очищаємо форму
    nameInput.value = '';
    imageInput.value = '';
    descriptionInput.value = '';
    temperatureInput.value = '';
    massInput.value = '';
    atmosphereInput.value = '';
    satellitesInput.value = '';
    missionsInput.value = '';

    await addPlanetModal.dismiss();

    // оновити головну сторінку, якщо вона показана
    const homePage = document.querySelector('page-home');
    if (homePage && typeof homePage.render === 'function') {
      homePage.render();
    }
  });
}
