# 📊 Order Updates System

A real-time order notification system that streams database changes from PostgreSQL to WebSocket clients via Redis pub/sub.

## 🏗️ System Architecture

![System Architecture](./system_architecture.png)


## 🚀 Features

- **Real-time Updates**: Instant notification when orders are created, updated, or deleted
- **Scalable Architecture**: Uses Redis pub/sub for horizontal scaling
- **Auto-reconnection**: Built-in resilience with exponential backoff
- **Web Dashboard**: Beautiful real-time dashboard with activity logs
- **Health Monitoring**: Connection status and error tracking
- **Easy Setup**: Single command to start all services

## 📁 Project Structure

```
order-updates-system/
├── 📁 publisher/                # PostgreSQL → Redis Bridge
│   ├── index.js                # Main publisher service
│   ├── redis-sub.js            # Redis subscriber test
│   └── package.json
├── 📁 ws-server/               # Redis → WebSocket Bridge  
│   ├── index.js                # WebSocket server
│   └── package.json
├── 📁 client-demo/             # Client Applications
│   ├── index.html              # Web dashboard
│   ├── cli.js                  # CLI client
│   └── package.json
├── main.js                     # Service orchestrator
├── test-connection.js          # Connection tester
└── package.json               # Main dependencies
```

## ⚡ Quick Start

### Prerequisites

- Node.js (v16+)
- PostgreSQL database
- Redis server

### 1. Clone & Install

```bash
git clone <repository-url>
cd order-updates-system
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
REDIS_URL=redis://localhost:6379
PORT=8080
```

### 3. Database Setup

Create the required database trigger and function in PostgreSQL:

```sql
-- Create orders table (if not exists)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255),
    product_name VARCHAR(255),
    status VARCHAR(50),
    amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notification function
CREATE OR REPLACE FUNCTION notify_order_changes()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('orders_channel', 
        json_build_object(
            'operation', TG_OP,
            'order', row_to_json(
                CASE 
                    WHEN TG_OP = 'DELETE' THEN OLD
                    ELSE NEW
                END
            )
        )::text
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS orders_notify_trigger ON orders;
CREATE TRIGGER orders_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_order_changes();
```

### 4. Test Connections

```bash
npm run test-connections
```

### 5. Start the System

```bash
npm start
```

This will start:
- 🔄 **Publisher Service** (PostgreSQL → Redis)
- 🌐 **WebSocket Server** (Redis → WebSocket clients)

### 6. Open the Dashboard

Open your browser to: `http://127.0.0.1:5500/client-demo/index.html`

Or use Live Server extension in VS Code for the `client-demo/index.html` file.

## 🎯 Usage Examples

### Test the System

Now that your database is set up, test the real-time updates:

1. **Insert a new order:**
```sql
INSERT INTO orders (customer_name, product_name, status) 
VALUES ('John Doe', 'Premium Widget', 'pending');
```

2. **Update an order:**
```sql
UPDATE orders SET status = 'completed' WHERE id = 1;
```

3. **Insert more orders:**
```sql
INSERT INTO orders (customer_name, product_name, status) VALUES 
('Jane Smith', 'Deluxe Package', 'processing'),
('Bob Wilson', 'Standard Plan', 'pending'),
('Alice Brown', 'Enterprise Suite', 'completed');
```

4. **Delete an order:**
```sql
DELETE FROM orders WHERE id = 1;
```

5. **Verify your table:**
```sql
SELECT * FROM orders ORDER BY created_at DESC;
```

Watch the real-time updates appear in your browser dashboard! 🎉

### CLI Client

For command-line monitoring:

```bash
npm run client-cli
```

## 🔧 Individual Service Commands

Run services separately for development:

```bash
# Publisher only
npm run publisher

# WebSocket server only  
npm run ws-server

# CLI client
npm run client-cli
```

## 📊 Dashboard Features

The web dashboard (`client-demo/index.html`) provides:

- 🟢 **Connection Status**: Visual connection state indicator
- 📝 **Activity Log**: Real-time order updates with color coding
- 🔄 **Auto-reconnection**: Handles connection drops gracefully
- 🧪 **Test Controls**: Reconnect and connection test buttons
- ⌨️ **Keyboard Shortcuts**: `Ctrl+R` (reconnect), `Ctrl+L` (clear log)

### Color Coding
- 🟢 **Green**: INSERT operations
- 🟡 **Yellow**: UPDATE operations  
- 🔴 **Red**: DELETE operations

## 🔍 Monitoring & Debugging

### Health Checks

The system provides multiple health check endpoints:

1. **Connection Test**: `npm run test-connections`
2. **WebSocket Test**: Use the dashboard's "Test Connection" button
3. **Redis Subscriber**: `node publisher/redis-sub.js`

### Log Monitoring

Each service provides detailed logs:

```bash
# Watch all services
npm start

# Individual service logs
npm run publisher  # PostgreSQL → Redis logs
npm run ws-server  # WebSocket server logs
```

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | Required |
| `PORT` | WebSocket server port | `8080` |
| `WS_URL` | WebSocket URL for clients | `ws://localhost:8080` |

### Customization

- **Redis Channels**: Modify `orders_channel` (PostgreSQL) and `orders_updates` (Redis)
- **WebSocket Port**: Change `PORT` environment variable
- **Reconnection Logic**: Adjust backoff timers in service files

## 🚨 Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if services are running
   pg_isready -d $DATABASE_URL
   redis-cli ping
   ```

2. **No Notifications Received**
   ```sql
   -- Verify trigger exists
   SELECT * FROM pg_trigger WHERE tgname = 'orders_notify_trigger';
   
   -- Test manual notification
   SELECT pg_notify('orders_channel', '{"test": true}');
   ```

3. **WebSocket Connection Failed**
   - Ensure port 8080 is available
   - Check firewall settings
   - Verify WebSocket URL in client

### Debug Mode

Enable detailed logging:

```bash
DEBUG=* npm start
```

## 📈 Performance Considerations

- **Scaling**: Add more WebSocket server instances behind a load balancer
- **Redis Clustering**: Use Redis Cluster for high availability
- **Connection Pooling**: Implement PostgreSQL connection pooling for high loads
- **Message Queuing**: Consider adding message persistence for critical updates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📝 License

This project is licensed under the ISC License.

---

## 🎉 That's It!

You now have a fully functional real-time order updates system! The dashboard will show live updates as you modify orders in your PostgreSQL database.

**Need help?** Check the troubleshooting section or open an issue.

**Want to extend it?** The modular architecture makes it easy to add new features like email notifications, Slack integration, or custom webhooks.

Happy coding! 🚀