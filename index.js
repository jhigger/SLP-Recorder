const {initializeApp} = require('firebase/app');
const {
	getFirestore,
	collection,
	addDoc,
	getDocs,
	serverTimestamp
} = require('firebase/firestore');
const fetch = require('node-fetch');
const cron = require('node-cron');
require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const firebaseConfig = {
	apiKey: process.env.apiKey,
	authDomain: process.env.authDomain,
	projectId: process.env.projectId,
	storageBucket: process.env.storageBucket,
	messagingSenderId: process.env.messagingSenderId,
	appId: process.env.appId
};

initializeApp(firebaseConfig);
const db = getFirestore();

const getSLP = async (ronin) => {
	const address = ronin.replace('ronin:', '0x');
	const response = await fetch(
		`https://game-api.axie.technology/slp/${address}`
	);
	const data = await response.json();
	const slp = data[0].total;
	return slp;
};

// const user = {
// 	ronin: 'ronin:988a8c5d5040ea80a9dee65796bb5351b0eed719',
// 	name: 'jhigger'
// };

// addDoc(collection(db, 'users'), user).then((doc) => {
// 	const id = doc.id;
// });

const addRecordForAllUsers = () => {
	getDocs(collection(db, 'users'))
		.then((snapshot) => {
			snapshot.docs.forEach((doc) => {
				console.log(`${doc.id} => ${JSON.stringify(doc.data())}`);
				const id = doc.id;
				const ronin = doc.data().ronin;

				getSLP(ronin).then((slp) => {
					const record = {
						slp: slp,
						timestamp: serverTimestamp()
					};

					addDoc(collection(db, 'users', id, 'records'), record).then((doc) => {
						console.log(`${doc.id} => slp:${slp}`);
					});
				});
			});
		})
		.catch((err) => {
			console.log(err);
		});
};

app.get('/', (req, res) => {
	res.send('Hello World!');
});

app.listen(port, () => {
	console.log(`Running at http://localhost:${port}`);
	console.log('Starting CRON Job');
	cron.schedule(
		'59 7 * * *',
		() => {
			console.log('Running addRecordForAllUsers every 7:59 AM');
			addRecordForAllUsers();
		},
		{
			timezone: 'Asia/Manila'
		}
	);
});
