# Docker Compose Lernbeispiel

### React-Frontend + Node.js/Express-Backend + MongoDB

Eine kleine Todo-App aus drei Containern. Sie zeigt die wichtigsten Docker-Compose-Konzepte:
**Images bauen**, **Ports exponieren**, **dedizierte Netzwerke** und **Volumes für persistente Daten**.

![page](./output.png)

---

## Architektur

```
  Browser
     │  http://localhost:3000   (einziger Port nach aussen)
     ▼
┌────────────┐   frontend-net   ┌────────────┐   backend-net   ┌────────────┐
│  frontend  │ ───── /api ────▶ │  backend   │ ──────────────▶ │   mongo    │
│  (React)   │                  │ (Express)  │                 │ (MongoDB)  │
└────────────┘                  └────────────┘                 └─────┬──────┘
                                                                     │ /data/db
                                                                     ▼
                                                              Volume mongo-data
```

| Service    | Image                         | Netzwerke                     | Port nach aussen | Persistenz                  |
| ---------- | ----------------------------- | ----------------------------- | ---------------- | --------------------------- |
| `mongo`    | `mongo:8` (Docker Hub)        | `backend-net`                 | –                | Volume `mongo-data:/data/db` |
| `backend`  | gebaut aus `backend/Dockerfile`  | `backend-net`, `frontend-net` | –                | –                           |
| `frontend` | gebaut aus `frontend/Dockerfile` | `frontend-net`                | **3000**         | –                           |

---

## Projektstruktur

```
.
├── compose.yaml          ← beschreibt alle drei Services (gut kommentiert, zuerst lesen!)
├── backend/
│   ├── Dockerfile        ← Bauanleitung für das Backend-Image
│   ├── server.js         ← Express-Server auf Port 3000
│   └── config/config.json← enthält die DB-Adresse mongodb://mongo:27017/TodoApp
└── frontend/
    ├── Dockerfile        ← Bauanleitung für das Frontend-Image
    ├── vite.config.js    ← proxy: /api → http://backend:3000
    └── src/              ← React-App
```

---

## Starten und Stoppen

Voraussetzung: Docker Desktop (oder Docker Engine mit Compose-Plugin). Port 3000 muss frei sein.

```powershell
docker compose up -d --build
```

Danach im Browser öffnen: <http://localhost:3000>

```powershell
docker compose ps
```

```powershell
docker compose logs -f backend
```

Stoppen (Container und Netzwerke werden entfernt, **das Volume bleibt**):

```powershell
docker compose down
```

Alles inklusive Datenbank-Daten löschen:

```powershell
docker compose down -v
```

---

## Die Konzepte im Detail

### 1. Image verwenden vs. Image bauen

- **`mongo`** nutzt ein fertiges Image von Docker Hub: `image: mongo:8`.
  Die Version ist fixiert, damit alle dieselbe Umgebung haben – `mongo:latest` könnte sich jederzeit ändern.
- **`backend`** und **`frontend`** werden aus ihrem eigenen `Dockerfile` gebaut:

  ```yaml
  build:
    context: ./backend      # Ordner mit dem Dockerfile
    target: development     # welche Stage des Multi-Stage-Dockerfiles gebaut wird
  ```

  Ein `Dockerfile` ist die Bauanleitung: Basis-Image (`FROM node:...`), Abhängigkeiten installieren
  (`RUN npm ci`), Code kopieren (`COPY`), Startbefehl (`CMD`).

### 2. Ports exponieren

```yaml
frontend:
  ports:
    - "3000:3000"     # <host-port>:<container-port>
```

Nur das Frontend hat einen `ports:`-Eintrag. Backend und Datenbank sind **von aussen nicht erreichbar** –
das ist gewollt: Weniger offene Ports bedeuten weniger Angriffsfläche.

> Wie kommt der Browser dann an die API? Der Vite-Dev-Server im Frontend-Container leitet alle
> Aufrufe auf `/api` an `http://backend:3000` weiter (`proxy` in `frontend/vite.config.js`).
> Der Browser spricht also nur mit Port 3000.

### 3. Dedizierte Netzwerke

```yaml
networks:
  frontend-net:
  backend-net:
```

Ohne eigene Netzwerke landen alle Services im selben `default`-Netz und können sich gegenseitig erreichen.
Mit zwei Netzwerken trennen wir die Schichten:

- `frontend` ist nur in `frontend-net` → sieht das Backend, **nicht** die Datenbank.
- `mongo` ist nur in `backend-net` → sieht das Backend, **nicht** das Frontend.
- `backend` ist in beiden → die einzige Brücke zwischen den Schichten.

**Service-Namen sind Hostnamen.** In jedem benutzerdefinierten Netzwerk betreibt Docker einen eingebauten DNS.
Deshalb funktioniert `mongodb://mongo:27017` im Backend und `http://backend:3000` im Frontend – ganz ohne IP-Adressen.

### 4. Volumes für persistente Daten

```yaml
mongo:
  volumes:
    - mongo-data:/data/db    # <volume-name>:<pfad-im-container>

volumes:
  mongo-data:
```

Ein Container ist kurzlebig: Wird er gelöscht, ist alles weg, was in ihm gespeichert war.
MongoDB schreibt seine Daten nach `/data/db`. Dort hängen wir ein **benanntes Volume** ein, das Docker
ausserhalb des Containers verwaltet. Es überlebt `docker compose down` und wird beim nächsten `up` wieder eingehängt.

### 5. Startreihenfolge mit `depends_on`

```yaml
backend:
  depends_on:
    - mongo
```

Compose startet zuerst `mongo`, dann `backend`, dann `frontend`. Achtung: `depends_on` wartet nur, bis der
Container **gestartet** ist, nicht bis die Datenbank **bereit** ist. Darum versucht das Backend die Verbindung
selbst alle 2 Sekunden erneut (`backend/db/index.js`).

---

## Übungen: selbst nachprüfen

**a) Volume: Überleben die Daten einen Neustart?**

1. Im Browser ein paar Todos anlegen.
2. `docker compose down` ausführen, dann `docker compose up -d`.
3. Seite neu laden → die Todos sind noch da.
4. Jetzt `docker compose down -v` und wieder `up -d` → die Liste ist leer. Warum?

```powershell
docker volume ls
```

```powershell
docker volume inspect docker-compose-sample_mongo-data
```

**b) Netzwerke: Wer sieht wen?**

Das Frontend erreicht das Backend:

```powershell
docker compose exec frontend node -e "require('http').get('http://backend:3000/api', r => console.log('OK', r.statusCode)).on('error', e => console.log('FEHLER', e.code))"
```

Das Frontend kennt die Datenbank nicht einmal (`ENOTFOUND`):

```powershell
docker compose exec frontend node -e "require('dns').lookup('mongo', (e, a) => console.log(e ? 'FEHLER ' + e.code : 'gefunden ' + a))"
```

Welche Container hängen in welchem Netz?

```powershell
docker network inspect docker-compose-sample_backend-net --format "{{range .Containers}}{{.Name}} {{end}}"
```

**c) Ports: Was ist von aussen erreichbar?**

`docker compose ps` zeigt nur beim Frontend `0.0.0.0:3000->3000/tcp`. Bei Backend und Mongo steht nur
`3000/tcp` bzw. `27017/tcp` – der Port existiert im Container, ist aber nicht auf den Host veröffentlicht.

**d) Zum Weiterdenken**

- Was passiert, wenn du beim Frontend zusätzlich `backend-net` einträgst?
- Wie müsste `compose.yaml` aussehen, damit du mit MongoDB Compass von deinem Rechner aus auf die DB kommst?
  Warum ist das in Produktion keine gute Idee?
- Was bewirkt `internal: true` beim `backend-net` (in `compose.yaml` auskommentiert)?
