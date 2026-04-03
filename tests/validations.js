const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ 
    allErrors: true,
    strict: false,
    coerceTypes: true,
    useDefaults: true,
    removeAdditional: false
});
addFormats(ajv);

// Пример шеме која дозвољава додатна својства
const responseSchema = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "orderId": { "type": "integer" },
            "orderNumber": { "type": "string" },
            "orderDate": { "type": "string", "format": "date-time" },
            "totalAmount": { "type": "number" },
            "currency": { "type": "string" },
            "status": { "type": "string", "enum": ["pending", "completed", "cancelled", "processing"] },
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "productId": { "type": "integer" },
                        "productName": { "type": "string" },
                        "quantity": { "type": "integer", "minimum": 1 },
                        "price": { "type": "number", "minimum": 0 }
                    },
                    "required": ["productId", "productName", "quantity", "price"]
                }
            }
        },
        "required": ["orderId", "orderNumber", "orderDate", "totalAmount", "status"]
    }
};

// Ваши default подаци
const defaultData = [
    {
        "orderId": 1001,
        "orderNumber": "ORD-2023-001",
        "orderDate": "2023-05-15T14:30:00",
        "totalAmount": 12500.5,
        "currency": "RSD",
        "status": "completed",
        "items": [
            {
                "productId": 45,
                "productName": "Laptop",
                "quantity": 1,
                "price": 12000
            },
            {
                "productId": 78,
                "productName": "Miš",
                "quantity": 1,
                "price": 500.5
            }
        ]
    }
];

const validate = ajv.compile(responseSchema);
const isValid = validate(defaultData);

console.log('Is valid:', isValid);
if (!isValid) {
    console.log('Errors:', validate.errors);
} else {
    console.log('Validation passed!');
}