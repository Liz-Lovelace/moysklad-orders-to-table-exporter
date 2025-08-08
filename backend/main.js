import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { getAllOrders, getSalesChannelsMap } from './moyskladAPI.js';

dotenv.config({ quiet: true });

let tableData = []; // Array<Array<string>>
let latestDate = 'N/A';

const app = express();
app.use(express.json());

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Function to load and process the HTML template
function loadTemplate(templateData) {
  const templatePath = path.join(process.cwd(), 'backend', 'main-template.html');
  let template = fs.readFileSync(templatePath, 'utf8');
  
  // Replace placeholders with actual data
  template = template.replace('{{DATE}}', templateData.date);
  template = template.replace('{{DATE}}', templateData.date); // Replace second occurrence in title
  template = template.replace('{{ORDER_COUNT}}', templateData.orderCount);
  template = template.replace('{{TABLE_ROWS}}', templateData.tableRows);
  
  return template;
}

// GET / endpoint to display orders from the latest date
app.get('/', (req, res) => {
  try {
    // Serve from precomputed table data
    if (!tableData || tableData.length === 0) {
      return res.send(`
        <html>
          <head>
            <title>Latest Orders</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              h1 { color: #333; }
            </style>
          </head>
          <body>
            <h1>Latest Orders</h1>
            <p>No orders found in cache.</p>
          </body>
        </html>
      `);
    }

    // Build HTML rows from tableData (array of string arrays)
    const tableRowsHtml = tableData
      .map(cells => `<tr>${cells.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
      .join('');

    const htmlContent = loadTemplate({
      date: latestDate,
      orderCount: tableData.length,
      tableRows: tableRowsHtml
    });

    res.send(htmlContent);
  } catch (error) {
    console.error('Error generating orders page:', error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Error</h1>
          <p>Failed to load orders: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

main();

async function main() {
  app.listen(3000, () => {
    console.log(`Server running on http://localhost:3000`);
  });

  await updateTable();

  console.log(tableData);
  
  // setInterval(updateOrders, 5 * 60 * 1000);
}

function tableRowsFromData(allOrders, salesChannelIdToName) {
  const dates = (allOrders || [])
    .map(order => (order && order.moment ? order.moment.split(' ')[0] : null))
    .filter(date => date !== null);

  const latestDate = dates.length > 0
    ? dates.reduce((latest, current) => (current > latest ? current : latest))
    : 'N/A';

  const latestOrders = latestDate === 'N/A'
    ? []
    : allOrders.filter(order => order.moment && order.moment.startsWith(latestDate));

  const rows = latestOrders.map(order => {
    const salesChannelId = order.salesChannel && order.salesChannel.meta && order.salesChannel.meta.href
      ? order.salesChannel.meta.href.split('/').pop()
      : order.salesChannel && order.salesChannel.id
        ? order.salesChannel.id
        : undefined;
    const salesChannelName = (salesChannelId && salesChannelIdToName.get(salesChannelId))
      || (order.salesChannel && order.salesChannel.name)
      || 'N/A';
    const amount = order && typeof order.sum === 'number'
      ? (order.sum / 10000).toLocaleString('ru-RU')
      : 'N/A';
    const description = (order && order.description) || 'No description';
    const address = (order && (order.shipmentAddress 
                  || (order.shipmentAddressFull && order.shipmentAddressFull.addInfo)))
                  || 'No address';
    const orderName = (order && order.name) || 'N/A';

    return [orderName, salesChannelName, description, amount, address];
  });

  return {
    date: latestDate,
    rows
  };
}

async function updateTable() {
  try {
    console.log('updating orders...')
    const [orders, channelMap] = await Promise.all([
      getAllOrders(),
      getSalesChannelsMap()
    ]);

    const result = tableRowsFromData(orders, channelMap);
    latestDate = result.date;
    tableData = result.rows;
    console.log('Table updated successfully');
  } catch (error) {
    console.error('Error updating orders:', error);
  }
}
