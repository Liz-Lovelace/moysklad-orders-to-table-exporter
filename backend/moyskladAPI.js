import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export async function getAllOrders() {
  return await getAllEntities('customerorder');
}

export async function getGoodsForOrder(order) {
  if (!order.positions || !order.positions.meta || !order.positions.meta.href) {
    console.error(`No positions data for order ${order.name}`);
    return [];
  }

  const positionsData = await moyskladAPI('GET', order.positions.meta.href);
  const positions = positionsData.rows || [];
  
  // Fetch assortment data for each position sequentially
  const positionsWithAssortment = [];
  for (const position of positions) {
    if (position.assortment && position.assortment.meta && position.assortment.meta.href) {
      try {
        const assortmentData = await moyskladAPI('GET', position.assortment.meta.href);
        
        positionsWithAssortment.push({
          ...position,
          assortmentData: assortmentData
        });
      } catch (error) {
        console.error(`Error fetching assortment for position in order ${order.name}:`, error);
        positionsWithAssortment.push(position);
      }
    } else {
      console.error(`No assortment data for position in order ${order.name}`);
      positionsWithAssortment.push(position);
    }
  }
  
  return positionsWithAssortment;
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

export async function getCounterpartyPhonesMap() {
  const rows = await getAllEntities('counterparty');
  const idToPhone = new Map();
  for (const row of rows) {
    if (row.id && row.phone) {
      idToPhone.set(row.id, row.phone);
    }
  }
  return idToPhone;
}

async function getAllEntities(entity) {
  const limit = 1000;
  let offset = 0;
  const allRows = [];

  while (true) {
    const url = new URL(`https://api.moysklad.ru/api/remap/1.2/entity/${entity}`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));

    const jsonData = await moyskladAPI('GET', url.toString());
    
    if (!jsonData || !Array.isArray(jsonData.rows)) {
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

async function moyskladAPI(method, url) {
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.API_TOKEN}`,
      'Accept': 'application/json;charset=utf-8',
      'Accept-Encoding': 'gzip'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status} - ${response.statusText}: ${errorText}`);
  }

  return await response.json();
}