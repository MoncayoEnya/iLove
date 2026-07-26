// tests/firestore.rules.test.js
//
// Run with: firebase emulators:exec --only firestore "npx mocha tests/firestore.rules.test.js --timeout 10000"
//
// This spins up the local Firestore emulator, runs these checks against
// your real firestore.rules file, then shuts down. Nothing here touches
// your live database.

const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing')
const fs = require('fs')
const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc } = require('firebase/firestore')

let testEnv

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'couple-companion-test',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  })
})

after(async () => {
  await testEnv.cleanup()
})

afterEach(async () => {
  await testEnv.clearFirestore()
})

// Helper: pre-load data as an admin, bypassing rules entirely — this sets
// up the "given" state before we test what a real user can/can't do.
async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore())
  })
}

describe('users/{uid}', () => {
  it('lets you create your own profile', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    await assertSucceeds(setDoc(doc(alice, 'users/alice'), { displayName: 'Alice', coupleId: null }))
  })

  it('blocks creating a profile under someone else\'s uid', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    await assertFails(setDoc(doc(alice, 'users/bob'), { displayName: 'Fake Bob' }))
  })

  it('lets you read your own profile', async () => {
    await seed((db) => setDoc(doc(db, 'users/alice'), { displayName: 'Alice', coupleId: null }))
    const alice = testEnv.authenticatedContext('alice').firestore()
    await assertSucceeds(getDoc(doc(alice, 'users/alice')))
  })

  it('blocks an unrelated signed-in user from reading your profile', async () => {
    await seed((db) => setDoc(doc(db, 'users/alice'), { displayName: 'Alice', coupleId: null }))
    const mallory = testEnv.authenticatedContext('mallory').firestore()
    await assertFails(getDoc(doc(mallory, 'users/alice')))
  })

  it('blocks a signed-out reader entirely', async () => {
    await seed((db) => setDoc(doc(db, 'users/alice'), { displayName: 'Alice', coupleId: null }))
    const anon = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(anon, 'users/alice')))
  })

  it('lets your linked partner read your profile', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'couples/c1'), { members: ['alice', 'bob'] })
      await setDoc(doc(db, 'users/alice'), { displayName: 'Alice', coupleId: 'c1' })
    })
    const bob = testEnv.authenticatedContext('bob').firestore()
    await assertSucceeds(getDoc(doc(bob, 'users/alice')))
  })
})

describe('couples/{coupleId}', () => {
  it('lets you create a couple doc that includes yourself as a member', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    await assertSucceeds(setDoc(doc(alice, 'couples/c1'), { members: ['alice'] }))
  })

  it('blocks creating a couple doc that does not include you', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    await assertFails(setDoc(doc(alice, 'couples/c1'), { members: ['bob'] }))
  })

  it('lets a second person join an open (1-member) couple', async () => {
    await seed((db) => setDoc(doc(db, 'couples/c1'), { members: ['alice'] }))
    const bob = testEnv.authenticatedContext('bob').firestore()
    await assertSucceeds(updateDoc(doc(bob, 'couples/c1'), { members: ['alice', 'bob'] }))
  })

  it('blocks a third person from joining an already-full couple', async () => {
    await seed((db) => setDoc(doc(db, 'couples/c1'), { members: ['alice', 'bob'] }))
    const mallory = testEnv.authenticatedContext('mallory').firestore()
    await assertFails(updateDoc(doc(mallory, 'couples/c1'), { members: ['alice', 'bob', 'mallory'] }))
  })

  it('blocks a stranger from reading the couple doc', async () => {
    await seed((db) => setDoc(doc(db, 'couples/c1'), { members: ['alice', 'bob'] }))
    const mallory = testEnv.authenticatedContext('mallory').firestore()
    await assertFails(getDoc(doc(mallory, 'couples/c1')))
  })

  it('lets the last remaining member delete the couple doc (unlink flow)', async () => {
    await seed((db) => setDoc(doc(db, 'couples/c1'), { members: ['alice'] }))
    const alice = testEnv.authenticatedContext('alice').firestore()
    await assertSucceeds(deleteDoc(doc(alice, 'couples/c1')))
  })

  it('blocks deleting the couple doc while both partners are still members', async () => {
    await seed((db) => setDoc(doc(db, 'couples/c1'), { members: ['alice', 'bob'] }))
    const alice = testEnv.authenticatedContext('alice').firestore()
    await assertFails(deleteDoc(doc(alice, 'couples/c1')))
  })
})

describe('couples/{coupleId}/{subcollection} — tasks, events, messages, jar, checkins, memories, goals', () => {
  beforeEach(async () => {
    await seed((db) => setDoc(doc(db, 'couples/c1'), { members: ['alice', 'bob'] }))
  })

  it('lets a member read the shared tasks', async () => {
    await seed((db) => setDoc(doc(db, 'couples/c1/tasks/t1'), { text: 'Buy milk', done: false }))
    const alice = testEnv.authenticatedContext('alice').firestore()
    await assertSucceeds(getDoc(doc(alice, 'couples/c1/tasks/t1')))
  })

  it('lets a member write a new task', async () => {
    const bob = testEnv.authenticatedContext('bob').firestore()
    await assertSucceeds(addDoc(collection(bob, 'couples/c1/tasks'), { text: 'Water plants', done: false }))
  })

  it('blocks a stranger from reading tasks', async () => {
    await seed((db) => setDoc(doc(db, 'couples/c1/tasks/t1'), { text: 'Buy milk', done: false }))
    const mallory = testEnv.authenticatedContext('mallory').firestore()
    await assertFails(getDoc(doc(mallory, 'couples/c1/tasks/t1')))
  })

  it('blocks a stranger from writing a task into someone else\'s couple', async () => {
    const mallory = testEnv.authenticatedContext('mallory').firestore()
    await assertFails(addDoc(collection(mallory, 'couples/c1/tasks'), { text: 'Sneaky task' }))
  })

  it('blocks a stranger from reading memories photos', async () => {
    await seed((db) => setDoc(doc(db, 'couples/c1/memories/m1'), { photoData: 'data:...', caption: 'Trip' }))
    const mallory = testEnv.authenticatedContext('mallory').firestore()
    await assertFails(getDoc(doc(mallory, 'couples/c1/memories/m1')))
  })

  it('lets a member read/write goals', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    await assertSucceeds(addDoc(collection(alice, 'couples/c1/goals'), { title: 'Save for trip', progress: 0 }))
  })
})