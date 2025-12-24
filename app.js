// app.js

const API_URL = 'https://university-api-alpha.vercel.app/api/planets';

/**
 * Прочитати кастомні планети з localStorage
 */
function getSavedPlanets() {
  try {
    const raw = localStorage.getItem('planets');
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch (e) {
    console.error('Помилка читання localStorage:', e);
    return [];
  }
}

/**
 * Домішати збережені користувачем планети до основних
 */
function mergePlanets(apiPlanets) {
  const saved = getSavedPlanets();
  return apiPlanets.concat(saved);
}

/**
 * Витягти імʼя планети з хеша URL: #/planet/Name
 */
function getPlanetNameFromHash() {
  const hash = window.location.hash || '#/';
  const parts = hash.split('/');
  const rawName = parts[2] || '';
  return decodeURIComponent(rawName);
}

/**
 * ГОЛОВНА СТОРІНКА
 */
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.planets = [];
    this.sortMode = 'name-asc'; // name-asc | name-desc | mass-desc
    this.apiError = false;      // ⬅ флаг, что API не загрузилось
  }

  connectedCallback() {
    // сразу первый рендер (может показать локальные планеты)
    this.render();
    // тянем данные с API
    this.fetchPlanetsData();
  }

  async fetchPlanetsData() {
    const loader = document.querySelector('ion-loading');
    try {
      if (loader) await loader.present();

      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();

      this.planets = data.map((planet) => ({
        name: planet.name,
        image: planet.imgSrc?.img || '',
        description: planet.description || '',
        details: {
          mass: planet.basicDetails?.mass || 'N/A',
          volume: planet.basicDetails?.volume || 'N/A',
          source: planet.source || '',
          wikiLink: planet.wikiLink || '',
        },
      }));

      this.apiError = false;
    } catch (error) {
      console.error('Помилка при отриманні даних про планети:', error);
      // API не працює – ставимо прапорець, але НЕ ламаємо інтерфейс
      this.apiError = true;
    } finally {
      if (loader) {
        try {
          await loader.dismiss();
        } catch (_) {}
      }
      // після будь-якого результату перерендерим сторінку
      this.render();
    }
  }

  getSortedPlanets() {
    const all = mergePlanets(this.planets);

    if (this.sortMode === 'name-asc') {
      all.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
    } else if (this.sortMode === 'name-desc') {
      all.sort((a, b) => b.name.localeCompare(a.name, 'uk'));
    } else if (this.sortMode === 'mass-desc') {
      // грубе сортування за масою, якщо є число на початку
      all.sort((a, b) => {
        const ma = parseFloat(String(a.details?.mass || '').replace(/[^\d.-]/g, '')) || 0;
        const mb = parseFloat(String(b.details?.mass || '').replace(/[^\d.-]/g, '')) || 0;
        return mb - ma;
      });
    }

    return all;
  }

  render() {
    const planets = this.getSortedPlanets();

    this.innerHTML = `
      <ion-header>
        <ion-toolbar>
          <ion-title>Планети Сонячної системи</ion-title>
        </ion-toolbar>
        <div class="sort-bar">
          <ion-segment value="${this.sortMode}" id="sort-segment">
            <ion-segment-button value="name-asc">
              <ion-label>Ім'я A→Я</ion-label>
            </ion-segment-button>
            <ion-segment-button value="name-desc">
              <ion-label>Ім'я Я→A</ion-label>
            </ion-segment-button>
            <ion-segment-button value="mass-desc">
              <ion-label>Маса ↓</ion-label>
            </ion-segment-button>
          </ion-segment>

          ${
            this.apiError
              ? `<div class="error-message">
                   Не вдалося завантажити дані з сервера. 
                   Показано лише локально збережені планети.
                 </div>`
              : ''
          }
        </div>
      </ion-header>
      <ion-content>
        ${
          planets.length === 0
            ? `<div class="empty-message">
                 Даних про планети поки що немає. 
                 Спробуйте оновити сторінку або додайте свою планету.
               </div>`
            : `
          <ion-grid>
            <ion-row>
              ${planets
                .map(
                  (planet) => `
                <ion-col size="12" size-sm="6" size-md="4">
                  <ion-card class="planet-card" button href="#/planet/${encodeURIComponent(
                    planet.name
                  )}">
                    <ion-img src="${planet.image}"></ion-img>
                    <ion-card-header>
                      <ion-card-title>${planet.name}</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                      <p>${planet.description}</p>
                    </ion-card-content>
                  </ion-card>
                </ion-col>
              `
                )
                .join('')}
            </ion-row>
          </ion-grid>
        `
        }
      </ion-content>
    `;

    // обработчик смены сортировки
    const segment = this.querySelector('#sort-segment');
    if (segment) {
      segment.addEventListener('ionChange', (ev) => {
        const value = ev.detail?.value || ev.target.value;
        if (!value) return;
        this.sortMode = value;
        this.render();
      });
    }
  }
}

/**
 * СТОРІНКА ДЕТАЛЕЙ ПЛАНЕТИ
 */
class PlanetPage extends HTMLElement {
  async connectedCallback() {
    await this.loadPlanet();
  }

  async loadPlanet() {
    const planetName = getPlanetNameFromHash();

    if (!planetName) {
      this.renderNotFound();
      return;
    }

    // спочатку шукаємо серед локальних + кастомних
    const saved = mergePlanets([]);
    let planet = saved.find((p) => p.name === planetName);

    const loader = document.querySelector('ion-loading');

    try {
      if (!planet) {
        if (loader) await loader.present();
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const apiPlanet = data.find((p) => p.name === planetName);
        if (apiPlanet) {
          planet = {
            name: apiPlanet.name,
            image: apiPlanet.imgSrc?.img || '',
            description: apiPlanet.description || '',
            details: {
              mass: apiPlanet.basicDetails?.mass || 'N/A',
              volume: apiPlanet.basicDetails?.volume || 'N/A',
              source: apiPlanet.source || '',
              wikiLink: apiPlanet.wikiLink || '',
            },
          };
        }
      }
    } catch (e) {
      console.error('Помилка завантаження планети:', e);
      // якщо не змогли витягнути з API і немає локальної – далі просто покажемо "не знайдена"
    } finally {
      if (loader) {
        try {
          await loader.dismiss();
        } catch (_) {}
      }
    }

    if (!planet) {
      this.renderNotFound();
      return;
    }

    this.renderPlanet(planet);
  }

  renderNotFound() {
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
  }

  renderPlanet(planet) {
    const details = planet.details || {};

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

        <ion-img src="${planet.image}"></ion-img>

        <ion-card>
          <ion-card-content>
            <p>${planet.description}</p>
          </ion-card-content>
        </ion-card>

        <ion-chip color="secondary">
          <ion-label>Маса: ${details.mass || 'N/A'}</ion-label>
        </ion-chip>

        ${
          details.volume
            ? `
          <ion-chip color="tertiary">
            <ion-label>Обʼєм: ${details.volume}</ion-label>
          </ion-chip>
        `
            : ''
        }

        ${
          details.wikiLink
            ? `
          <ion-chip color="primary">
            <ion-label>
              <a href="${details.wikiLink}" target="_blank" rel="noopener noreferrer">
                Wiki
              </a>
            </ion-label>
          </ion-chip>
        `
            : ''
        }

        ${
          !details.atmosphere &&
          !details.satellites &&
          !details.missions
            ? ''
            : `
        <ion-accordion-group>
          ${
            details.atmosphere
              ? `
          <ion-accordion value="atmosphere">
            <ion-item slot="header">
              <ion-label>Хімічний склад атмосфери</ion-label>
            </ion-item>
            <div class="ion-padding" slot="content">
              <p>${details.atmosphere}</p>
            </div>
          </ion-accordion>
          `
              : ''
          }
          ${
            details.satellites
              ? `
          <ion-accordion value="satellites">
            <ion-item slot="header">
              <ion-label>Супутники</ion-label>
            </ion-item>
            <div class="ion-padding" slot="content">
              <p>${Array.isArray(details.satellites) ? details.satellites.join(', ') : details.satellites}</p>
            </div>
          </ion-accordion>
          `
              : ''
          }
          ${
            details.missions
              ? `
          <ion-accordion value="missions">
            <ion-item slot="header">
              <ion-label>Дослідження</ion-label>
            </ion-item>
            <div class="ion-padding" slot="content">
              <ion-list>
                ${
                  Array.isArray(details.missions)
                    ? details.missions.map((m) => `<ion-item>${m}</ion-item>`).join('')
                    : `<ion-item>${details.missions}</ion-item>`
                }
              </ion-list>
            </div>
          </ion-accordion>
          `
              : ''
          }
        </ion-accordion-group>
        `
        }
      </ion-content>
    `;
  }
}

// реєструємо кастомні елементи
customElements.define('page-home', HomePage);
customElements.define('planet-page', PlanetPage);

// при зміні hash оновлюємо сторінку планети
window.addEventListener('hashchange', () => {
  const outlet = document.querySelector('ion-router-outlet');
  if (!outlet) return;
  const current = outlet.querySelector('planet-page');
  if (current && typeof current.loadPlanet === 'function') {
    current.loadPlanet();
  }
});
