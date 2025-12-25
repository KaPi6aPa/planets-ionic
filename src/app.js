import { CapacitorHttp } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const API_URL = 'https://university-api-alpha.vercel.app/api/planets';
const CUSTOM_PLANETS_KEY = 'custom_planets';

// ===== helpers для Preferences =====

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

// тут будем кешувати останні завантажені з API планети,
// щоб сторінка деталей могла ними користуватись
let latestApiPlanets = [];

// ===== КОМПОНЕНТ ГОЛОВНОЇ СТОРІНКИ =====

class HomePage extends HTMLElement {
  constructor() {
    super();
    this.apiPlanets = [];
    this.customPlanets = [];
    this.errorMessage = null;
    this.currentSort = 'name-asc'; // за замовчуванням
  }

  connectedCallback() {
    this.init();
  }

  async init() {
    // 1) читаємо користувацькі планети з Preferences
    this.customPlanets = await loadCustomPlanets();

    // 2) показуємо "скелет" сторінки (щоб не було пустого екрану)
    this.render();

    // 3) тягнемо дані з API через CapacitorHttp
    await this.fetchPlanetsData();
  }

  async fetchPlanetsData() {
    const loader = document.querySelector('ion-loading');
    if (loader) await loader.present();

    try {
      const response = await CapacitorHttp.get({
        url: API_URL
      });

      const data = response.data;

      if (!Array.isArray(data)) {
        throw new Error('Некоректний формат відповіді API');
      }

      // Мапимо під свій формат
      this.apiPlanets = data.map((planet) => ({
        id: planet.id,
        name: planet.name,
        image: planet.imgSrc?.img,
        description: planet.description,
        details: {
          mass: planet.basicDetails?.mass
        }
      }));

      latestApiPlanets = this.apiPlanets;
      this.errorMessage = null;
    } catch (err) {
      console.error('Помилка при отриманні планет:', err);
      this.errorMessage =
        'Не вдалося завантажити дані з сервера. Спробуйте оновити сторінку пізніше.';
      this.apiPlanets = [];
    } finally {
      if (loader) await loader.dismiss();
      this.render(); // оновити сторінку з даними або помилкою
    }
  }

  // обʼєднуємо API + кастомні, застосовуємо сортування
  getAllPlanets() {
    let all = [...this.apiPlanets, ...this.customPlanets];

    if (this.currentSort === 'name-asc') {
      all.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
    } else if (this.currentSort === 'name-desc') {
      all.sort((a, b) => b.name.localeCompare(a.name, 'uk'));
    } else if (this.currentSort === 'mass') {
      // намагаємось з масою, якщо є
      all.sort((a, b) => {
        const ma = parseFloat((a.details?.mass || '').replace(/[^\d.]/g, '')) || 0;
        const mb = parseFloat((b.details?.mass || '').replace(/[^\d.]/g, '')) || 0;
        return ma - mb;
      });
    }

    return all;
  }

  render() {
    const planets = this.getAllPlanets();

    const errorHtml = this.errorMessage
      ? `<div class="error-banner">${this.errorMessage}</div>`
      : '';

    const planetsHtml =
      planets.length === 0
        ? `<p class="ion-padding">Немає даних про планети.</p>`
        : planets
            .map(
              (planet) => `
        <ion-col size="12" size-sm="6" size-md="4">
          <ion-card class="planet-card" button href="/planet/${encodeURIComponent(
            planet.name
          )}">
            <ion-img src="${planet.image || ''}"></ion-img>
            <ion-card-header>
              <ion-card-title>${planet.name}</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <p>${planet.description || ''}</p>
            </ion-card-content>
          </ion-card>
        </ion-col>
      `
            )
            .join('');

    this.innerHTML = `
      <ion-header>
        <ion-toolbar>
          <ion-title>Планети Сонячної системи</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content>
        ${errorHtml}

        <div class="sort-bar">
          <ion-segment id="sortSegment" value="${this.currentSort}">
            <ion-segment-button value="name-asc">
              <ion-label>Імʼя А→Я</ion-label>
            </ion-segment-button>
            <ion-segment-button value="name-desc">
              <ion-label>Імʼя Я→А</ion-label>
            </ion-segment-button>
            <ion-segment-button value="mass">
              <ion-label>За масою</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>

        <ion-grid>
          <ion-row>
            ${planetsHtml}
          </ion-row>
        </ion-grid>
      </ion-content>
    `;

    // навешиваем обработчик сортировки
    const sortSegment = this.querySelector('#sortSegment');
    if (sortSegment) {
      sortSegment.addEventListener('ionChange', (ev) => {
        const value = ev.detail.value;
        this.currentSort = value || 'name-asc';
        this.render();
      });
    }
  }

  // метод, чтобы модалка могла «обновить» список после добавления планеты
  async reloadAfterAdd() {
    this.customPlanets = await loadCustomPlanets();
    this.render();
  }
}

customElements.define('page-home', HomePage);

// ===== СТОРІНКА ДЕТАЛЕЙ ПЛАНЕТИ =====

class PlanetPage extends HTMLElement {
  connectedCallback() {
    this.init();
  }

  async init() {
    const path = window.location.pathname; // /planet/Name
    const parts = path.split('/');
    const planetName = decodeURIComponent(parts[parts.length - 1] || '').trim();

    const custom = await loadCustomPlanets();
    const all = [...latestApiPlanets, ...custom];

    const planet = all.find((p) => p.name === planetName);

    if (!planet) {
      this.innerHTML = `
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-back-button defaultHref="/"></ion-back-button>
            </ion-buttons>
            <ion-title>Планета не знайдена</ion-title>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <p>На жаль, інформація про цю планету відсутня.</p>
        </ion-content>
      `;
      return;
    }

    const d = planet.details || {};

    const chips = [];

    if (d.temperature) {
      chips.push(
        `<ion-chip color="primary"><ion-label>Температура: ${d.temperature}</ion-label></ion-chip>`
      );
    }
    if (d.mass) {
      chips.push(
        `<ion-chip color="secondary"><ion-label>Маса: ${d.mass}</ion-label></ion-chip>`
      );
    }
    if (d.distance) {
      chips.push(
        `<ion-chip color="tertiary"><ion-label>Відстань: ${d.distance}</ion-label></ion-chip>`
      );
    }
    if (d.discovery) {
      chips.push(
        `<ion-chip color="success"><ion-label>Рік відкриття: ${d.discovery}</ion-label></ion-chip>`
      );
    }

    const atmosphereBlock = d.atmosphere
      ? `
        <ion-accordion value="atmosphere">
          <ion-item slot="header">
            <ion-label>Хімічний склад атмосфери</ion-label>
          </ion-item>
          <div class="ion-padding" slot="content">
            <p>${d.atmosphere}</p>
          </div>
        </ion-accordion>
      `
      : '';

    const satellitesBlock = d.satellites
      ? `
        <ion-accordion value="satellites">
          <ion-item slot="header">
            <ion-label>Супутники</ion-label>
          </ion-item>
          <div class="ion-padding" slot="content">
            <p>${
              Array.isArray(d.satellites) ? d.satellites.join(', ') : d.satellites
            }</p>
          </div>
        </ion-accordion>
      `
      : '';

    const missionsBlock = d.missions
      ? `
        <ion-accordion value="missions">
          <ion-item slot="header">
            <ion-label>Місії / дослідження</ion-label>
          </ion-item>
          <div class="ion-padding" slot="content">
            <ion-list>
              ${
                Array.isArray(d.missions)
                  ? d.missions.map((m) => `<ion-item>${m}</ion-item>`).join('')
                  : `<ion-item>${d.missions}</ion-item>`
              }
            </ion-list>
          </div>
        </ion-accordion>
      `
      : '';

    this.innerHTML = `
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-back-button defaultHref="/"></ion-back-button>
          </ion-buttons>
          <ion-title>${planet.name}</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content>
        <ion-breadcrumbs>
          <ion-breadcrumb href="/">Головна</ion-breadcrumb>
          <ion-breadcrumb>${planet.name}</ion-breadcrumb>
        </ion-breadcrumbs>

        <ion-img src="${planet.image || ''}"></ion-img>

        <ion-card>
          <ion-card-content>
            <p>${planet.description || ''}</p>
          </ion-card-content>
        </ion-card>

        ${chips.join('')}

        <ion-accordion-group>
          ${atmosphereBlock}
          ${satellitesBlock}
          ${missionsBlock}
        </ion-accordion-group>
      </ion-content>
    `;
  }

  static get observedAttributes() {
    return ['name'];
  }

  attributeChangedCallback() {
    this.init();
  }
}

customElements.define('planet-page', PlanetPage);
