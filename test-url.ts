import http from 'http';

const url = 'http://localhost:3000/';

console.log('Testing URL:', url);

const req = http.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response Headers:', res.headers);
    
    // Prüfe auf Script-Fehler im HTML
    const scriptMatches = data.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    if (scriptMatches) {
      console.log('\n=== Found Scripts ===');
      scriptMatches.forEach((script, idx) => {
        // Prüfe auf Syntax-Fehler
        if (script.includes('${') && script.includes('}')) {
          console.log(`\nScript ${idx + 1} contains template literals - checking...`);
        }
        
        // Prüfe auf ungeschlossene Strings
        const singleQuotes = (script.match(/'/g) || []).length;
        const doubleQuotes = (script.match(/"/g) || []).length;
        if (singleQuotes % 2 !== 0) {
          console.error(`⚠️ Script ${idx + 1}: Ungerade Anzahl von Single Quotes!`);
        }
        if (doubleQuotes % 2 !== 0) {
          console.error(`⚠️ Script ${idx + 1}: Ungerade Anzahl von Double Quotes!`);
        }
        
        // Prüfe auf ungeschlossene Template Literals
        const backticks = (script.match(/`/g) || []).length;
        if (backticks % 2 !== 0) {
          console.error(`⚠️ Script ${idx + 1}: Ungerade Anzahl von Backticks!`);
        }
      });
    }
    
    // Prüfe auf häufige Fehler
    if (data.includes('Uncaught SyntaxError')) {
      console.error('\n⚠️ Found "Uncaught SyntaxError" in response!');
    }
    
    if (data.includes('Invalid or unexpected token')) {
      console.error('\n⚠️ Found "Invalid or unexpected token" in response!');
    }
    
    // Zeige ersten Teil des HTML
    console.log('\n=== First 500 chars of HTML ===');
    console.log(data.substring(0, 500));
    
    // Suche nach Script-Tags und zeige deren Inhalt
    const inlineScripts = data.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    if (inlineScripts) {
      console.log('\n=== Inline Scripts Found ===');
      inlineScripts.forEach((script, idx) => {
        const content = script.match(/<script[^>]*>([\s\S]*?)<\/script>/);
        if (content && content[1]) {
          const scriptContent = content[1];
          console.log(`\n--- Script ${idx + 1} (${scriptContent.length} chars) ---`);
          
          // Prüfe auf häufige Fehler
          const lines = scriptContent.split('\n');
          lines.forEach((line, lineNum) => {
            // Prüfe auf ungeschlossene Template Literals
            if (line.includes('${') && !line.includes('}')) {
              console.error(`⚠️ Line ${lineNum + 1}: Möglicherweise ungeschlossenes Template Literal`);
            }
            
            // Prüfe auf ungeschlossene Strings
            const singleQuotesInLine = (line.match(/'/g) || []).length;
            const doubleQuotesInLine = (line.match(/"/g) || []).length;
            if (singleQuotesInLine % 2 !== 0) {
              console.error(`⚠️ Line ${lineNum + 1}: Ungerade Anzahl Single Quotes: "${line.substring(0, 100)}"`);
            }
            if (doubleQuotesInLine % 2 !== 0) {
              console.error(`⚠️ Line ${lineNum + 1}: Ungerade Anzahl Double Quotes: "${line.substring(0, 100)}"`);
            }
          });
          
          // Zeige ersten Teil
          console.log(scriptContent.substring(0, 300));
        }
      });
    }
  });
});

req.on('error', (error: any) => {
  if (error.code === 'ECONNREFUSED') {
    console.error('❌ Server läuft nicht auf http://localhost:3000/');
    console.error('Starte den Server mit: npm run dev');
    process.exit(1);
  } else {
    console.error('Request Error:', error.message);
  }
});

req.end();

