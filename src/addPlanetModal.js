import { Preferences } from '@capacitor/preferences';

const CUSTOM_PLANETS_KEY = 'custom_planets';

async function loadCustomPlanets() {
  try {
    const { value } = await Preferences.get({ key: CUSTOM_PLANETS_KEY });
    if (!value) return [];
    return JSON.parse(value);
  } catch (e) {
    console.error('Помилка читання custom planets з Preferences:', e);
    return [];
  }
}

async function saveCustomPlanets(list) {
  try {
    await Preferences.set({
      key: CUSTOM_PLANETS_KEY,
      value: JSON.stringify(list)
    });
  } catch (e) {
    console.error('Помилка запису custom planets в Preferences:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const addPlanetModal = document.querySelector(
    'ion-modal[trigger="add-planet-modal"]'
  );
  if (!addPlanetModal) return;

  const closeModalButton = addPlanetModal.querySelector(
    '#close-add-planet-modal'
  );
  const confirmAddPlanetButton = addPlanetModal.querySelector(
    '#confirm-add-planet'
  );

  if (closeModalButton) {
    closeModalButton.addEventListener('click', async () => {
      await addPlanetModal.dismiss();
    });
  }

  if (confirmAddPlanetButton) {
    confirmAddPlanetButton.addEventListener('click', async () => {
      const nameInput = addPlanetModal.querySelector('#planetName');
      const imageInput = addPlanetModal.querySelector('#planetImage');
      const descriptionInput =
        addPlanetModal.querySelector('#planetDescription');
      const temperatureInput =
        addPlanetModal.querySelector('#planetTemperature');
      const massInput = addPlanetModal.querySelector('#planetMass');
      const atmosphereInput =
        addPlanetModal.querySelector('#planetAtmosphere');
      const satellitesInput =
        addPlanetModal.querySelector('#planetSatellites');
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
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s),
          missions: missionsInput.value
            .split(',')
            .map((m) => m.trim())
            .filter((m) => m)
        }
      };

      if (!newPlanet.name || !newPlanet.image || !newPlanet.description) {
        alert("Будь ласка, заповніть всі обов'язкові поля (позначені *).");
        return;
      }

      const savedPlanets = await loadCustomPlanets();
      savedPlanets.push(newPlanet);
      await saveCustomPlanets(savedPlanets);

      // очищаем форму
      nameInput.value = '';
      imageInput.value = '';
      descriptionInput.value = '';
      temperatureInput.value = '';
      massInput.value = '';
      atmosphereInput.value = '';
      satellitesInput.value = '';
      missionsInput.value = '';

      await addPlanetModal.dismiss();

      // просим головну сторінку перерендеритись
      const homePage = document.querySelector('page-home');
      if (homePage && typeof homePage.reloadAfterAdd === 'function') {
        homePage.reloadAfterAdd();
      }
    });
  }
});
