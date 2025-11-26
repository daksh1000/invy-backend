// Request logging middleware
function requestLogger(req, res, next) {
    const timestamp = new Date().toISOString();
    console.log(`\n🌐 [${timestamp}] ${req.method} ${req.originalUrl}`);
    console.log(`   IP: ${req.ip}`);
    console.log(`   User-Agent: ${req.get('user-agent')}`);
    
    if (Object.keys(req.query).length > 0) {
        console.log(`   Query: ${JSON.stringify(req.query)}`);
    }
    
    if (Object.keys(req.params).length > 0) {
        console.log(`   Params: ${JSON.stringify(req.params)}`);
    }
    
    if (req.body && Object.keys(req.body).length > 0 && req.method !== 'GET') {
        // Don't log password fields
        const sanitizedBody = { ...req.body };
        if (sanitizedBody.password) sanitizedBody.password = '***';
        console.log(`   Body: ${JSON.stringify(sanitizedBody)}`);
    }
    
    next();
}

module.exports = { requestLogger };
