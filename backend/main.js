import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';

dotenv.config();

let cachedMoyskladOrders = [];

const app = express();
app.use(express.json());

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
    // Find the latest date among all orders
    if (cachedMoyskladOrders.length === 0) {
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

    // Extract dates and find the latest one
    const dates = cachedMoyskladOrders
      .map(order => order.moment ? order.moment.split(' ')[0] : null)
      .filter(date => date !== null);
    
    const latestDate = dates.reduce((latest, current) => {
      return current > latest ? current : latest;
    });

    // Filter orders for the latest date
    const latestOrders = cachedMoyskladOrders.filter(order => 
      order.moment && order.moment.startsWith(latestDate)
    );

    // Generate table rows
    const tableRows = latestOrders.map(order => {
      const time = order.moment ? order.moment.split(' ')[1] : 'N/A';
      const amount = order.sum ? (order.sum / 10000).toLocaleString('ru-RU') : 'N/A';
      const description = order.description || 'No description';
      const address = order.shipmentAddress || 
                    (order.shipmentAddressFull && order.shipmentAddressFull.addInfo) || 
                    'No address';
      
      return `
        <tr>
          <td>${order.name || 'N/A'}</td>
          <td>${time}</td>
          <td class="description">${description}</td>
          <td class="amount">${amount}</td>
          <td class="address">${address}</td>
        </tr>
      `;
    }).join('');

    // Load template with data
    const htmlContent = loadTemplate({
      date: latestDate,
      orderCount: latestOrders.length,
      tableRows: tableRows
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

  await updateOrders();

  console.log(JSON.stringify(cachedMoyskladOrders[0], null, 2))
  
  setInterval(updateOrders, 5 * 60 * 1000);
}

async function getAllOrders() {
  const limit = 1000;
  let offset = 0;
  let allOrders = [];

  while (true) {
    const response = await fetch(`https://api.moysklad.ru/api/remap/1.2/entity/customerorder?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN}`,
        'Accept-Encoding': 'gzip'
      }
    });
    console.log('fetched some orders')

    const jsonData = await response.json();

    allOrders = allOrders.concat(jsonData.rows);

    if (jsonData.rows.length < limit) {
      break;
    }

    offset += limit;
  }
  
  console.log(allOrders.length)
  return allOrders;
}

async function updateOrders() {
  try {
    console.log('updating orders...')
    cachedMoyskladOrders = await getAllOrders();
    console.log('Orders updated successfully');
  } catch (error) {
    console.error('Error updating orders:', error);
  }
}
