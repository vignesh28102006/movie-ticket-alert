import { INITIAL_MOVIES, INITIAL_THEATRES } from '../src/lib/db/seed-data';

async function seed() {
  console.log('Seeding Movie Ticket Catalog...');
  console.log(`Movies (${INITIAL_MOVIES.length}):`, INITIAL_MOVIES.map((m) => m.title).join(', '));
  console.log(`Theatres (${INITIAL_THEATRES.length}):`, INITIAL_THEATRES.map((t) => `${t.name} (${t.city})`).join(', '));
  console.log('✅ Catalog ready for local & remote database provisioning.');
}

seed();
