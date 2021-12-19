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
	doc,
	limit
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

// Returns an array of (15) records of a user
const getUserRecords = (id, lim = 15) => {
	const q = query(
		collection(db, 'users', id, 'records'),
		orderBy('timestamp', 'desc'),
		limit(lim)
	);
	return getDocs(q)
		.then((snapshot) => {
			return snapshot.docs.map((record) => record.data());
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

// Returns an array of all user's slp farmed yesterday
const getAllYesterdaySLP = () => {
	return getAllUsers()
		.then((users) =>
			users.map(({name, yesterday}) => {
				return {
					name,
					yesterday
				};
			})
		)
		.catch((err) => {
			console.log(err);
		});
};

const getDailySLP = (id) => {
	return getUserRecords(id)
		.then((records) => {
			return records.map((record, i, array) => {
				let slp = 0;

				if (array.length > 1) {
					if (i + 1 <= array.length - 1) {
						slp = records[i].slp - records[i + 1].slp;
					}
				} else if (array.length == 1) {
					slp = records[i].slp;
				}

				const datetime = record.timestamp.toDate();
				datetime.setDate(datetime.getDate() - 1);
				const day = datetime.toDateString();

				return {slp, day};
			});
		})
		.catch((err) => {
			console.log(err);
		});
};

const getALLDailySLP = () => {
	return getAllUsers()
		.then((users) =>
			users.map(async ({id, name, ronin}) => {
				const daily = await getDailySLP(id);
				return {name, ronin, daily};
			})
		)
		.catch((err) => {
			console.log(err);
		});
};

const calculateYesterday = (records) => {
	let slp = 0;

	if (records.length > 1) {
		slp = records[0].slp - records[1].slp;
	} else if (records.length == 1) {
		slp = records[0].slp;
	}

	return slp;
};

const updateYesterdaySLP = (id) => {
	getUserRecords(id, 2)
		.then(calculateYesterday(records))
		.then((yesterday) => {
			updateDoc(doc(db, 'users', id), {yesterday});
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
						slp,
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

app.get('/', (req, res) => {
	res.send('Hello World!');
});

app.get('/yesterday', async (req, res) => {
	const data = await getAllYesterdaySLP();
	Promise.all(data).then((array) => {
		res.json(array);
	});
});

app.get('/daily', async (req, res) => {
	const data = await getALLDailySLP();
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
