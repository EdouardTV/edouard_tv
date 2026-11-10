# La collection : mise en ligne et utilisation

Le site se compose de deux pages :

- `index.html` : le site public (collection, carte, top 10). C'est le lien à mettre en bio.
- `admin.html` : ta page de gestion, pour tout modifier depuis ton téléphone. Elle ne fonctionne qu'avec ton jeton d'accès personnel.

Toutes les données sont dans un seul fichier, `data/collection.json`. Les photos vont dans le dossier `photos/`, créé automatiquement au premier envoi.

Mise en place : environ 30 minutes, une seule fois, de préférence sur un ordinateur.

---

## Étape 1. Créer un compte GitHub

1. Va sur github.com et crée un compte gratuit.
2. Choisis bien le nom d'utilisateur : il apparaîtra dans l'adresse du site. GitHub n'accepte pas le tiret bas, donc `edouard_tv` est impossible. Exemple possible : `edouard-tv` (s'il est libre).

L'adresse du site sera alors : `https://edouard-tv.github.io`

## Étape 2. Créer le dépôt

1. En haut à droite, bouton **+**, puis **New repository**.
2. Nom du dépôt : exactement `ton-nom-utilisateur.github.io`. Exemple : `edouard-tv.github.io`.
3. Coche **Public**. GitHub Pages gratuit exige un dépôt public : tout le monde peut donc voir les fichiers du site, ce qui ne pose pas de problème ici. Ne mets jamais de données privées dans ce dépôt.
4. Clique sur **Create repository**.

## Étape 3. Envoyer les fichiers

1. Décompresse le fichier zip sur ton ordinateur.
2. Dans le dépôt, clique sur **uploading an existing file** (ou **Add file**, puis **Upload files**).
3. Ouvre le dossier décompressé et fais glisser **son contenu** dans la page : `index.html`, `admin.html`, `GUIDE.md` et les dossiers `assets`, `data` et `vendor`. Ne glisse pas le dossier parent lui-même.
4. Clique sur **Commit changes**.

Vérifie ensuite que le dépôt affiche bien `index.html` à la racine, et non dans un sous-dossier.

## Étape 4. Activer le site

1. Dans le dépôt : **Settings**, puis **Pages** dans le menu de gauche.
2. Sous **Build and deployment**, Source : **Deploy from a branch**. Branche : **main**, dossier : **/ (root)**. Clique sur **Save**.
3. Attends une à deux minutes, puis ouvre `https://ton-nom-utilisateur.github.io`.

## Étape 5. Créer ton jeton d'accès (pour modifier le site)

Le jeton est un mot de passe limité à ce seul dépôt. Il permet à la page de gestion d'enregistrer tes modifications.

1. Clique sur ta photo de profil en haut à droite, puis **Settings**.
2. Tout en bas du menu de gauche : **Developer settings**.
3. **Personal access tokens**, puis **Fine-grained tokens**, puis **Generate new token**.
4. Remplis :
   - **Token name** : `collection`
   - **Expiration** : la durée la plus longue proposée. À l'expiration, il suffira d'en créer un nouveau.
   - **Repository access** : **Only select repositories**, puis choisis ton dépôt `...github.io`.
   - **Permissions**, **Repository permissions**, **Contents** : **Read and write**. Ne coche rien d'autre.
5. Clique sur **Generate token** et copie le jeton tout de suite : GitHub ne l'affichera plus jamais.

## Étape 6. Se connecter à la page de gestion

1. Sur ton téléphone, ouvre `https://ton-nom-utilisateur.github.io/admin.html`.
2. Nom d'utilisateur et nom du dépôt sont pré-remplis. Colle le jeton, garde « Se souvenir de moi » coché, puis **Se connecter**.
3. Conseil : ajoute cette page à l'écran d'accueil de ton téléphone pour la retrouver vite.

## Étape 7. Le lien en bio

Mets `https://ton-nom-utilisateur.github.io` dans tes bios TikTok, Instagram et YouTube. Pour renvoyer vers une espèce précise, par exemple dans une description de vidéo : `https://ton-nom-utilisateur.github.io/#n028` ouvre directement la fiche #028.

---

## Utilisation au quotidien

**Ajouter un nouvel animal**
Onglet **Espèces**, puis **Ajouter une espèce**. Le numéro suivant est proposé automatiquement. Remplis le nom, le reste si tu le connais, la date, le lieu et le lien de la vidéo, puis **Enregistrer**.

**Ajouter une photo**
Dans la fiche de l'espèce, **Ajouter une photo**, puis choisis-la dans ta galerie. Elle est réduite automatiquement et enregistrée tout de suite. Les photos sont recadrées en carré dans la liste : un animal centré rend mieux.

**Revoir un animal déjà dans la collection**
Ouvre sa fiche, puis **Ajouter une observation**. Le compteur « Vu X fois » et la carte se mettent à jour d'eux-mêmes.

**Modifier n'importe quoi**
Nom, numéro, date, lieu, lien, groupe, ordre et famille se modifient dans la fiche. Le top 10 se règle dans l'onglet **Top 10**, les lieux dans **Lieux**, le titre et les liens des réseaux dans **Réglages**.

**Décaler des numéros**
**Réglages**, puis **Décaler les numéros**. Exemple : « à partir du numéro 12, +1 » libère le numéro 12 et décale toutes les espèces suivantes.

**Délai d'affichage**
Après chaque enregistrement, le site public se met à jour en une à deux minutes. Si rien ne change, recharge la page du site.

**Sauvegarde**
**Réglages**, puis **Télécharger une sauvegarde**, de temps en temps. GitHub garde aussi l'historique de chaque modification : en cas d'erreur, toute version précédente du fichier est récupérable.

## Si quelque chose ne va pas

- « GitHub refuse le jeton » : le jeton a expiré ou a été mal copié. Crée-en un nouveau (étape 5).
- « Le jeton n'a pas le droit d'écrire » : à l'étape 5, la permission **Contents** doit être sur **Read and write**, pour le bon dépôt.
- « Le fichier a été modifié ailleurs » : tu as enregistré depuis un autre appareil ou un autre onglet. Recharge la page de gestion.

## Sécurité

- Le jeton reste dans le navigateur de ton téléphone et n'est envoyé qu'à GitHub. Ne le partage avec personne et ne le colle nulle part ailleurs.
- Si tu perds ton téléphone : sur GitHub, **Developer settings**, **Fine-grained tokens**, supprime le jeton. Il devient immédiatement inutilisable.
- Sur un appareil qui n'est pas le tien, décoche « Se souvenir de moi », ou utilise **Se déconnecter** dans les Réglages.
