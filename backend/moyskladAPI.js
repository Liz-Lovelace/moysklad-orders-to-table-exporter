import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export async function getAllOrders() {
  const limit = 1000;
  let offset = 0;
  let allOrders = [];

  while (true) {
    const url = `https://api.moysklad.ru/api/remap/1.2/entity/customerorder?limit=${limit}&offset=${offset}&expand=salesChannel`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN}`,
        'Accept': 'application/json;charset=utf-8',
        'Accept-Encoding': 'gzip'
      }
    });
    console.log('fetched some orders');

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Request failed ${response.status}: ${response.statusText} -> ${errorText}`);
      throw new Error(`Failed to fetch orders: HTTP ${response.status}`);
    }

    const jsonData = await response.json();

    if (!jsonData || !Array.isArray(jsonData.rows)) {
      console.error('Unexpected response payload (no rows):', JSON.stringify(jsonData)?.slice(0, 1000));
      throw new Error('Unexpected API payload: rows missing');
    }

    allOrders = allOrders.concat(jsonData.rows);

    if (jsonData.rows.length < limit) {
      break;
    }

    offset += limit;
  }

  console.log(allOrders.length);
  return allOrders;
}


export async function getSalesChannelsMap() {
  const limit = 1000;
  let offset = 0;
  const idToName = new Map();

  while (true) {
    const url = `https://api.moysklad.ru/api/remap/1.2/entity/saleschannel?limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN}`,
        'Accept': 'application/json;charset=utf-8',
        'Accept-Encoding': 'gzip'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Saleschannel request failed ${response.status}: ${response.statusText} -> ${errorText}`);
      throw new Error(`Failed to fetch sales channels: HTTP ${response.status}`);
    }

    const jsonData = await response.json();
    if (!jsonData || !Array.isArray(jsonData.rows)) {
      console.error('Unexpected saleschannel payload (no rows):', JSON.stringify(jsonData)?.slice(0, 1000));
      throw new Error('Unexpected API payload for saleschannel: rows missing');
    }

    for (const row of jsonData.rows) {
      if (row.id && row.name) {
        idToName.set(row.id, row.name);
      }
    }

    if (jsonData.rows.length < limit) {
      break;
    }
    offset += limit;
  }

  return idToName;
}


