import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export async function getAllOrders() {
  return await getAllEntities('customerorder');
}

export async function getSalesChannelsMap() {
  const rows = await getAllEntities('saleschannel');
  const idToName = new Map();
  for (const row of rows) {
    if (row.id && row.name) {
      idToName.set(row.id, row.name);
    }
  }
  return idToName;
}

async function getAllEntities(entity) {
  const limit = 1000;
  let offset = 0;
  const allRows = [];

  while (true) {
    const url = new URL(`https://api.moysklad.ru/api/remap/1.2/entity/${entity}`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN}`,
        'Accept': 'application/json;charset=utf-8',
        'Accept-Encoding': 'gzip'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Request failed ${response.status}: ${response.statusText} -> ${errorText}`);
      throw new Error(`Failed to fetch ${entity}: HTTP ${response.status}`);
    }

    const jsonData = await response.json();
    if (!jsonData || !Array.isArray(jsonData.rows)) {
      console.error(`Unexpected ${entity} payload (no rows):`, JSON.stringify(jsonData)?.slice(0, 1000));
      throw new Error(`Unexpected API payload for ${entity}: rows missing`);
    }

    allRows.push(...jsonData.rows);

    if (jsonData.rows.length < limit) {
      break;
    }
    offset += limit;
  }

  return allRows;
}