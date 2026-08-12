/* ============================================================
   NIGHT SHIFT — Données du scénario (v4)
   Structure en actes progressifs + puzzles variés.
   ============================================================ */

const CULPRIT = "julien";

/* ----------------------------------------------------------
   INDICES — chaque indice a un poids (pertinence pour le score)
   et appartient à un acte donné.
---------------------------------------------------------- */
const CLUE_DEFS = {
  // Acte 1
  siem:        { text:"SIEM : transfert de 2.3 Go déclenché à 03:42 depuis une session VPN authentifiée sous le compte j.faure.", weight:3, points:true, node:"vpn-log", act:1 },
  vpn_ip:      { text:"VPN : connexion établie depuis l'IP 185.44.12.9 (à investiguer).", weight:1, points:true, node:"vpn-log", act:1 },
  whois:       { text:"Lookup IP : 185.44.12.9 est un range résidentiel basé à Bruxelles, Belgique (Proximus).", weight:2, points:true, node:"vpn-log", act:1 },

  // Acte 2 — puzzles
  cipher:      { text:"Note déchiffrée (César) : 'HACKED THE FILE SERVER FROM BRUSSELS' — correspond à la localisation IP relevée.", weight:3, points:true, node:"cipher-log", act:2 },
  hexpass:     { text:"Mot de passe caché décodé (hexadécimal) : 'REVANCHE2026' — retrouvé dans un fichier de config abandonné par l'attaquant.", weight:2, points:true, node:"hex-log", act:2 },
  timeline:    { text:"Reconstruction chronologique confirmée : le compte j.faure n'a plus été utilisé en interne depuis le 15 février, puis réapparaît uniquement le 14 mars à 03h41, depuis l'étranger.", weight:3, points:true, node:"timeline-log", act:2 },

  // Acte 3 — Active Directory / mail (débloqués après acte 2)
  ad:          { text:"Active Directory : le compte j.faure est toujours ACTIF alors qu'il aurait dû être désactivé le 15 février (ticket IT #4521 jamais traité).", weight:3, points:true, node:"ad-log", act:3 },
  mail:        { text:"Messagerie : un brouillon non envoyé de j.faure mentionne vouloir 'récupérer ce qui lui est dû' avant de partir définitivement.", weight:2, points:true, node:"mail-log", act:3 },

  // Interrogatoires
  claire_alibi:     { text:"Interrogatoire : Claire (RH) confirme que Julien avait menacé, lors de son pot de départ, de 'faire payer' la direction.", weight:2, points:true, node:"claire", act:3 },
  claire_followup:  { text:"Interrogatoire (relance, après ticket IT) : Claire confirme que Julien connaissait très bien l'architecture des serveurs RH, il les avait lui-même mis en place.", weight:2, points:true, node:"claire", act:3 },
  marc_redherring:  { text:"Interrogatoire : Marc admet être en retard sur les tickets de désactivation de comptes — négligence, mais pas malveillance.", weight:1, points:false, node:"marc", act:3 },
  sarah_redherring: { text:"Interrogatoire : Sarah confirme que son accès VPN expire automatiquement à 18h, elle ne peut techniquement pas être connectée la nuit.", weight:1, points:false, node:"sarah", act:3 },
  julien_slip:      { text:"Interrogatoire (relance, après preuve IP) : confronté à la localisation belge, Julien se contredit — il évite de préciser où il était, alors que Claire confirme qu'il a de la famille à Bruxelles.", weight:3, points:true, node:"julien", act:3 },
};

const HINTS = [
  "Commence par le SIEM, puis fais un lookup de l'IP suspecte trouvée dans les logs VPN.",
  "Le décalage du chiffre de César se situe entre 1 et 5.",
  "Pour le puzzle hexadécimal, convertis chaque paire de caractères en code ASCII (ex: 52 = 'R').",
  "Pour la chronologie, place le 'silence radio' avant l'alerte finale : le compte n'a servi qu'au tout début et à la toute fin.",
  "Une fois l'Acte 2 terminé, retourne interroger Claire et Julien : de nouvelles questions apparaissent.",
];

/* ----------------------------------------------------------
   SUSPECTS — questions de base + relances débloquées par preuve
---------------------------------------------------------- */
const suspects = [
  {
    id:"marc", name:"Marc Dubreuil", role:"Administrateur systèmes",
    bio:"12 ans d'ancienneté. Gère seul l'IT pour 140 personnes, visiblement débordé.",
    questions:[
      { q:"Où étiez-vous cette nuit au moment de l'alerte ?",
        a:"« Chez moi, en astreinte. J'ai vu l'alerte sur mon téléphone à 03:46, j'ai eu le temps de me connecter mais le mal était fait. »", clue:null },
      { q:"Le compte de Julien Faure était-il censé être désactivé ?",
        a:"« ...Oui. Normalement dans les 48h après un départ. On a un ticket ouvert dessus depuis février, mais avec la charge de travail... je n'ai pas eu le temps. C'est ma faute, mais je n'ai rien fait de malveillant. »", clue:"marc_redherring" },
      { q:"Avez-vous accédé aux fichiers RH récemment ?",
        a:"« Jamais sans raison. Je n'ai aucun intérêt à toucher à ces données, ce n'est pas mon rôle. »", clue:null }
    ],
    followups:[]
  },
  {
    id:"sarah", name:"Sarah Nkomo", role:"Stagiaire IT",
    bio:"Arrivée il y a 3 semaines. Accès VPN temporaire pour un projet de migration.",
    questions:[
      { q:"Avez-vous utilisé le VPN cette nuit ?",
        a:"« Non, je ne travaille jamais la nuit, et mon accès VPN expire à 18h de toute façon, il est configuré comme ça. »", clue:"sarah_redherring" },
      { q:"Connaissez-vous Julien Faure ?",
        a:"« Je l'ai croisé une fois avant son départ, mais je ne le connais pas vraiment. Il avait l'air... amer, sur la fin. »", clue:null },
      { q:"Avez-vous accès aux fichiers RH ?",
        a:"« Non, mon accès est limité aux serveurs de test pour la migration. Je n'ai jamais touché aux dossiers RH. »", clue:null }
    ],
    followups:[]
  },
  {
    id:"julien", name:"Julien Faure", role:"Ex-développeur (parti le 15 février)",
    bio:"Licencié après un conflit avec la direction sur une prime impayée. Ses accès étaient censés être coupés à son départ.",
    questions:[
      { q:"Avez-vous encore accès aux systèmes de SecuriTech ?",
        a:"« Non, absolument pas, tout a été coupé le jour de mon départ. Vous perdez votre temps avec moi. »", clue:null },
      { q:"Où étiez-vous cette nuit ?",
        a:"« Chez moi, seul. Personne pour le confirmer, désolé. »", clue:null },
      { q:"Vous gardez un ressentiment envers SecuriTech ?",
        a:"« Ils me doivent trois mois de prime sur un projet que j'ai livré seul. Alors oui, disons que je ne pleure pas pour eux. Mais de là à les attaquer... »", clue:null }
    ],
    followups:[
      { requires:"whois",
        q:"Nos logs situent la connexion à Bruxelles. Vous avez un lien avec la Belgique ?",
        a:"« ...Chez moi, je veux dire, non, je ne suis jamais allé en Belgique. » (il évite votre regard)", clue:"julien_slip" }
    ]
  },
  {
    id:"claire", name:"Claire Aubert", role:"Responsable RH",
    bio:"Propriétaire légitime des fichiers ciblés. A organisé le pot de départ de Julien.",
    questions:[
      { q:"Qui avait accès aux fichiers RH exfiltrés ?",
        a:"« En théorie seulement moi, mon assistante, et l'IT en cas de besoin technique. »", clue:null },
      { q:"Comment s'est passé le départ de Julien Faure ?",
        a:"« Tendu. Il estimait qu'on lui devait de l'argent. Au pot de départ, il a dit devant plusieurs collègues qu'il 'nous ferait payer d'une manière ou d'une autre'. Sur le coup on a pris ça pour de l'amertume passagère... »", clue:"claire_alibi" },
      { q:"Avez-vous remarqué une activité inhabituelle sur votre propre compte ?",
        a:"« Non, mon poste était éteint cette nuit-là, je vis à 40 minutes du bureau. »", clue:null }
    ],
    followups:[
      { requires:"ad",
        q:"Le compte de Julien n'a jamais été désactivé. Il connaissait bien l'infrastructure ?",
        a:"« Trop bien, oui. C'est même lui qui avait configuré une partie du serveur de fichiers RH avant son départ. Il savait exactement où chercher. Et il a de la famille à Bruxelles, maintenant que vous le dites... »", clue:"claire_followup" }
    ]
  }
];

/* ----------------------------------------------------------
   ACTE 1 — Logs réseau initiaux
---------------------------------------------------------- */
const logs_act1 = [
  { id:"siem", title:"🛰️ SIEM — Alerte de transfert anormal",
    reveal:`[03:42:03] ALERT: Large outbound transfer detected
Source: FILESERVER-RH-01
Destination: 185.44.12.9 (external)
Volume: 2.3 GB
Session user: j.faure
Session origin: VPN-GTW-02`, clue:"siem" },
  { id:"vpn", title:"🌐 Passerelle VPN — Historique de connexion",
    reveal:`user: j.faure
2026-03-14 03:41:12 - CONNECT - IP: 185.44.12.9
2026-03-14 03:44:50 - DISCONNECT (session manually closed)
GeoIP: non résolu — utilise l'outil de lookup ci-dessous.`, clue:"vpn_ip" },
];

/* ----------------------------------------------------------
   ACTE 2 — Puzzles forensiques
---------------------------------------------------------- */

const CIPHER_SOURCE = "KDFNHG WKH ILOH VHUYHU IURP EUXVVHOV";
const CIPHER_ANSWER = "HACKED THE FILE SERVER FROM BRUSSELS";

const HEX_SOURCE = "52 45 56 41 4E 43 48 45 32 30 32 36";
const HEX_ANSWER = "REVANCHE2026";

const TIMELINE_EVENTS = [
  { id:"e1", label:"15 février — Départ officiel de Julien Faure, ticket de désactivation ouvert", order:1 },
  { id:"e2", label:"15 février → 13 mars — Aucune activité sur le compte j.faure (silence radio)", order:2 },
  { id:"e3", label:"13 mars, 22h10 — Connexion test furtive de 2 minutes depuis la Belgique", order:3 },
  { id:"e4", label:"14 mars, 03h41 — Connexion principale + début du transfert de données", order:4 },
  { id:"e5", label:"14 mars, 03h44 — Déconnexion volontaire, tentative d'effacement partiel des logs", order:5 },
];

/* ----------------------------------------------------------
   ACTE 3 — Logs internes (débloqués après l'acte 2)
---------------------------------------------------------- */
const logs_act3 = [
  { id:"ad", title:"🗄️ Active Directory — Statut des comptes",
    reveal:`Account: j.faure
Status: ENABLED
Expected deactivation: 2026-02-15 (employee offboarding)
Linked ticket: IT-4521 "Disable j.faure access" — STATUS: OPEN (never closed)
Last password change: 2026-01-02`, clue:"ad" },
  { id:"mail", title:"✉️ Messagerie interne — Brouillons récupérés",
    reveal:`From: j.faure@securitech-corp.local (archived mailbox)
Draft (never sent), dated 2026-02-14
"...ils me doivent trois mois de prime et personne ne bouge.
Tant pis, je récupérerai ce qui m'est dû moi-même avant de
disparaître pour de bon..."`, clue:"mail" }
];

const TOTAL_STEPS = Object.keys(CLUE_DEFS).length;
