const {initializeApp} = require('firebase/app');
const {
	getFirestore,
	collection,
	addDoc,
	getDocs,
	serverTimestamp,
	query,
	orderBy,
	updateDoc,
	doc
} = require('firebase/firestore');
const fetch = require('node-fetch');
const cron = require('node-cron');
require('dotenv').config();
const cors = require('cors');

const express = require('express');
const app = express();
app.use(cors());
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

const updateYesterdaySLP = (id) => {
	const q = query(
		collection(db, 'users', id, 'records'),
		orderBy('timestamp', 'desc')
	);
	getDocs(q)
		.then((snapshot) => {
			const records = snapshot.docs;
			const length = records.length;
			const slp = 0;
			const a = records[0].data().slp;
			const b = records[1].data().slp;

			if (length > 1) {
				slp = a - b;
			} else if (length == 1) {
				slp = a;
			}

			return slp;
		})
		.then((yesterday) => {
			updateDoc(doc(db, 'users', id), {yesterday});
		})
		.catch((err) => {
			console.log(err);
		});
};

// Returns an array of all user documents
const getAllUsers = () => {
	const colRef = collection(db, 'users');
	return getDocs(colRef)
		.then((snapshot) => {
			return snapshot.docs.map((doc) => {
				const id = doc.id;
				const data = doc.data();
				return {id, ...data};
			});
		})
		.catch((err) => {
			console.log(err);
		});
};

const addRecordForAllUsers = () => {
	getAllUsers()
		.then((users) => {
			users.forEach((user) => {
				const id = user.id;
				const ronin = user.ronin;

				getSLP(ronin).then((slp) => {
					const colRef = collection(db, 'users', id, 'records');
					const record = {
						slp: slp,
						timestamp: serverTimestamp()
					};

					addDoc(colRef, record).then(() => {
						users.forEach((user) => {
							updateYesterdaySLP(user.id);
						});
					});
				});
			});
		})
		.catch((err) => {
			console.log(err);
		});
};

// Returns an array of all user's slp farmed yesterday
const getAllYesterdaySLP = () => {
	return getAllUsers()
		.then((users) =>
			users.map(({name, ronin, yesterday}) => {
				return {
					name,
					ronin,
					yesterday
				};
			})
		)
		.catch((err) => {
			console.log(err);
		});
};

app.get('/', (req, res) => {
	res.send('Hello World!');
});

app.get('/yesterday', async (req, res) => {
	const data = await getAllYesterdaySLP();
	Promise.all(data).then((array) => {
		res.json(array);
	});
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
