# Adding CRM Adapter Support

This backend now supports multiple CRM integrations through an adapter pattern:

## Supported CRMs
- Oracle CRM (default)
- Extensible to add SAP, Salesforce, Microsoft Dynamics, etc.

## Adding a New CRM Adapter

1. Create a new class extending `BaseCrmAdapter`
2. Implement required methods: `syncWorkOrders`, `syncWorkers`, `getWorkOrderDetails`, `submitWpsEntry`
3. Register the adapter: `crmRegistry.register('crm-name', new YourCrmAdapter())`
4. Set environment variable: `ACTIVE_CRM=crm-name`

## Environment Variables
- `ACTIVE_CRM`: Which CRM to use (oracle, sap, salesforce, etc.)
- `ORACLE_API_URL`: Oracle CRM API endpoint
- `ORACLE_API_KEY`: Oracle CRM API key
- Add similar variables for other CRMs as needed

## API Endpoints
- `POST /api/crm/sync/work-orders`: Sync work orders from active CRM
- `POST /api/crm/sync/workers`: Sync workers from active CRM
- `GET /api/crm/work-orders/:id`: Get detailed work order from CRM
- `POST /api/crm/wps/submit`: Submit WPS entry to CRM