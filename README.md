# Courses 🛒

Liste de courses **simple et épurée**, installable comme application (PWA) sur iOS, iPadOS, Android et desktop. Thème clair.

## Fonctionnalités (base)

- **Ajout rapide** d'un article avec sa catégorie.
- **Liste active groupée par catégorie**, cases à cocher, retrait des articles cochés.
- **Historique complet** de tout ce qui a déjà été saisi : on retrouve et re-ajoute un article en un tap.
- **Catégories modifiables** : créer, renommer, réordonner, supprimer.
- **Recherche** dans l'historique.
- **100 % hors-ligne** (service worker) et **données en local** (localStorage) — rien n'est envoyé sur un serveur.

## Installer sur iPhone / iPad

1. Ouvrir l'app dans **Safari**.
2. Bouton **Partager** → **Sur l'écran d'accueil**.
3. L'app s'ouvre alors en plein écran, comme une app native.

## Lancer en local

Aucune compilation. Il suffit de servir le dossier en HTTP (le service worker exige `http(s)`, pas `file://`) :

```bash
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page |
| `styles.css` | Thème clair, mise en page |
| `app.js` | Logique (état, rendu, stockage local) |
| `sw.js` | Service worker (hors-ligne) |
| `manifest.webmanifest` | Métadonnées PWA |
| `icons/` | Icônes générées |
| `scripts/gen-icons.js` | Génération des icônes PNG |

## Régénérer les icônes

```bash
node scripts/gen-icons.js
```
