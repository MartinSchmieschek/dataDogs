import { TypeDefBuilder } from './TypeDefBuilder';

/**
 * Test für TypeDefBuilder
 * Testet verschiedene Objektstrukturen, einschließlich axios-ähnlicher Objekte
 */

// Mock axios-ähnliches Objekt mit undefined Funktionen
const createAxiosLikeObject = () => {
  const axiosClient: any = {};
  // Simuliere axios-ähnliche Methoden, die undefined sind
  axiosClient.post = undefined;
  axiosClient.get = undefined;
  axiosClient.put = undefined;
  axiosClient.delete = undefined;
  axiosClient.patch = undefined;
  axiosClient.head = undefined;
  axiosClient.request = undefined;
  return axiosClient;
};

// Einfache Assert-Funktion
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ ASSERTION FAILED: ${message}`);
  }
}

// Test-Funktion mit Assertions
export function testTypeDefBuilder(): void {
  console.log('='.repeat(80));
  console.log('TypeDefBuilder Tests');
  console.log('='.repeat(80));
  console.log('');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  function runTest(name: string, testFn: () => void): void {
    try {
      testFn();
      testsPassed++;
      console.log(`✅ ${name}`);
    } catch (error: any) {
      testsFailed++;
      console.error(`❌ ${name}: ${error.message}`);
    }
  }

  // Test 1: Einfache Struktur
  runTest('Test 1: Einfache Struktur', () => {
    const simpleCtx = {
      name: 'test',
      age: 25,
      active: true
    };
    const result1 = TypeDefBuilder.buildContextLib('SimpleTest', simpleCtx);
    
    // Assertions - safeTypeName fügt "Node_" Präfix hinzu
    assert(result1.includes('type Node_SimpleTest') || result1.includes('Node_SimpleTest'), 'Sollte Node_SimpleTest Typ enthalten');
    assert(result1.includes('name: string'), 'Sollte name als string erkennen');
    assert(result1.includes('age: number'), 'Sollte age als number erkennen');
    assert(result1.includes('active: boolean'), 'Sollte active als boolean erkennen');
    assert(result1.includes('declare global'), 'Sollte global declarations enthalten');
  });

  // Test 2: Objekt mit undefined Werten
  runTest('Test 2: Objekt mit undefined Werten', () => {
    const undefinedCtx = {
      name: 'test',
      value: undefined,
      count: 42
    };
    const result2 = TypeDefBuilder.buildContextLib('UndefinedTest', undefinedCtx);
    
    // Assertions
    assert(result2.includes('value?: undefined'), 'Sollte undefined Werte als optional markieren');
    assert(result2.includes('name: string'), 'Sollte name als string erkennen');
    assert(result2.includes('count: number'), 'Sollte count als number erkennen');
  });

  // Test 3: Axios-ähnliches Objekt mit undefined Funktionen - KRITISCHER TEST
  runTest('Test 3: Axios-ähnliches Objekt mit undefined Funktionen', () => {
    const mockFetch = async () => new Response() as any;
    const axiosCtx = {
      fetch: typeof fetch !== 'undefined' ? fetch : mockFetch,
      console: console,
      axiosClient: createAxiosLikeObject()
    };
    const result3 = TypeDefBuilder.buildContextLib('AxiosTest', axiosCtx);
    
    // Assertions - Das ist der kritische Test für das Problem!
    assert(result3.includes('axiosClient'), 'Sollte axiosClient enthalten');
    
    // KRITISCH: Prüfe dass post/get/etc. als FUNKTIONEN erkannt werden (nicht als undefined)
    assert(result3.includes('post?: (...args: any[]) => Promise<any>'), 
      'Sollte post als Funktionstyp (...args: any[]) => Promise<any> erkennen, NICHT als undefined');
    assert(result3.includes('get?: (...args: any[]) => Promise<any>'), 
      'Sollte get als Funktionstyp (...args: any[]) => Promise<any> erkennen, NICHT als undefined');
    assert(result3.includes('put?: (...args: any[]) => Promise<any>'), 
      'Sollte put als Funktionstyp (...args: any[]) => Promise<any> erkennen');
    assert(result3.includes('delete?: (...args: any[]) => Promise<any>'), 
      'Sollte delete als Funktionstyp (...args: any[]) => Promise<any> erkennen');
    
    // Prüfe dass NICHT als undefined behandelt wird
    assert(!result3.includes('post?: undefined'), 'post sollte NICHT als undefined behandelt werden');
    assert(!result3.includes('get?: undefined'), 'get sollte NICHT als undefined behandelt werden');
    
    // Prüfe ob alle axios-Methoden erfasst werden
    const axiosMethods = ['post', 'get', 'put', 'delete', 'patch', 'head', 'request'];
    axiosMethods.forEach(method => {
      assert(result3.includes(method), `Sollte ${method} Methode enthalten`);
      // Prüfe dass jede Methode als Funktionstyp erkannt wird
      assert(result3.includes(`${method}?: (...args: any[]) => Promise<any>`), 
        `${method} sollte als Funktionstyp (...args: any[]) => Promise<any> erkannt werden`);
    });
    
    // Prüfe globale Deklaration für axiosClient
    assert(result3.includes('type axiosClient ='), 'Sollte globale Typ-Deklaration für axiosClient enthalten');
    assert(result3.includes('const axiosClient: axiosClient'), 'Sollte globale const-Deklaration für axiosClient enthalten');
  });

  // Test 4: Verschachtelte Objekte
  runTest('Test 4: Verschachtelte Objekte', () => {
    const nestedCtx = {
      user: {
        id: 1,
        name: 'John',
        email: undefined
      },
      config: {
        apiUrl: 'https://api.example.com',
        timeout: 5000
      }
    };
    const result4 = TypeDefBuilder.buildContextLib('NestedTest', nestedCtx);
    
    // Assertions
    assert(result4.includes('user:'), 'Sollte user Property enthalten');
    assert(result4.includes('config:'), 'Sollte config Property enthalten');
    assert(result4.includes('id: number'), 'Sollte verschachtelte id als number erkennen');
    assert(result4.includes('name: string'), 'Sollte verschachtelte name als string erkennen');
  });

  // Test 5: Arrays
  runTest('Test 5: Arrays', () => {
    const arrayCtx = {
      items: [1, 2, 3],
      tags: ['a', 'b', 'c'],
      empty: []
    };
    const result5 = TypeDefBuilder.buildContextLib('ArrayTest', arrayCtx);
    
    // Assertions
    assert(result5.includes('items:'), 'Sollte items Property enthalten');
    assert(result5.includes('tags:'), 'Sollte tags Property enthalten');
    assert(result5.includes('number[]') || result5.includes('items: number'), 'Sollte number Array erkennen');
    assert(result5.includes('string[]') || result5.includes('tags: string'), 'Sollte string Array erkennen');
  });

  // Test 6: Funktionen
  runTest('Test 6: Funktionen', () => {
    const functionCtx = {
      add: (a: number, b: number) => a + b,
      multiply: function(x: number, y: number) { return x * y; },
      noArgs: () => 'test'
    };
    const result6 = TypeDefBuilder.buildContextLib('FunctionTest', functionCtx);
    
    // Assertions
    assert(result6.includes('add:'), 'Sollte add Funktion enthalten');
    assert(result6.includes('multiply:'), 'Sollte multiply Funktion enthalten');
    assert(result6.includes('noArgs:'), 'Sollte noArgs Funktion enthalten');
    assert(result6.includes('=> any'), 'Sollte Funktionen als Funktionstypen erkennen');
  });

  // Test 7: Gemischte Struktur (wie im echten Szenario) - KRITISCHER TEST
  runTest('Test 7: Gemischte Struktur (Real-World Szenario)', () => {
    const mockFetch2 = async () => new Response() as any;
    const realWorldCtx = {
      fetch: typeof fetch !== 'undefined' ? fetch : mockFetch2,
      console: console,
      axiosClient: createAxiosLikeObject(),
      parentData: {
        id: 123,
        name: 'Parent'
      },
      items: [1, 2, 3]
    };
    const result7 = TypeDefBuilder.buildContextLib('RealWorldTest', realWorldCtx);
    
    // Assertions - Das ist der wichtigste Test!
    assert(result7.includes('axiosClient'), 'Sollte axiosClient enthalten');
    assert(result7.includes('parentData'), 'Sollte parentData enthalten');
    assert(result7.includes('items'), 'Sollte items enthalten');
    
    // KRITISCH: axiosClient sollte alle Methoden als FUNKTIONEN haben (nicht undefined)
    const axiosMethods = ['post', 'get', 'put', 'delete'];
    axiosMethods.forEach(method => {
      assert(result7.includes(method), `Sollte ${method} Methode in axiosClient enthalten`);
      // Prüfe dass als Funktionstyp behandelt wird (nicht undefined)
      assert(result7.includes(`${method}?: (...args: any[]) => Promise<any>`), 
        `${method} sollte als Funktionstyp (...args: any[]) => Promise<any> erkannt werden, NICHT als undefined`);
      assert(!result7.includes(`${method}?: undefined`), 
        `${method} sollte NICHT als undefined behandelt werden`);
    });
    
    // Prüfe globale Deklaration
    assert(result7.includes('const axiosClient: axiosClient'), 
      'Sollte globale const-Deklaration für axiosClient enthalten (für Monaco)');
  });

  // Test 8: Leeres Objekt
  runTest('Test 8: Leeres Objekt', () => {
    const emptyCtx = {};
    const result8 = TypeDefBuilder.buildContextLib('EmptyTest', emptyCtx);
    
    // Assertions - safeTypeName fügt "Node_" Präfix hinzu
    assert(result8.includes('type Node_EmptyTest') || result8.includes('Node_EmptyTest'), 'Sollte Node_EmptyTest Typ enthalten');
    assert(result8.includes('{}') || result8.includes('EmptyTest ='), 'Sollte leeres Objekt behandeln');
  });

  // Test 9: Null-Werte
  runTest('Test 9: Null-Werte', () => {
    const nullCtx = {
      value: null,
      name: 'test',
      data: undefined
    };
    const result9 = TypeDefBuilder.buildContextLib('NullTest', nullCtx);
    
    // Assertions
    assert(result9.includes('value: null'), 'Sollte null Werte als null erkennen');
    assert(result9.includes('name: string'), 'Sollte name als string erkennen');
    assert(result9.includes('data?:'), 'Sollte undefined Werte als optional markieren');
  });

  // Test 10: Axios-ähnliches Objekt mit gemischten Werten
  runTest('Test 10: Axios-ähnliches Objekt mit gemischten Werten', () => {
    const mixedAxiosCtx = {
      axiosClient: {
        post: undefined,
        get: undefined,
        baseURL: 'https://api.example.com',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    };
    const result10 = TypeDefBuilder.buildContextLib('MixedAxiosTest', mixedAxiosCtx);
    
    // Assertions
    assert(result10.includes('axiosClient'), 'Sollte axiosClient enthalten');
    
    // KRITISCH: post/get sollten als FUNKTIONEN erkannt werden
    assert(result10.includes('post?: (...args: any[]) => Promise<any>'), 
      'Sollte post als Funktionstyp (...args: any[]) => Promise<any> erkennen, NICHT als undefined');
    assert(result10.includes('get?: (...args: any[]) => Promise<any>'), 
      'Sollte get als Funktionstyp (...args: any[]) => Promise<any> erkennen, NICHT als undefined');
    assert(!result10.includes('post?: undefined'), 'post sollte NICHT als undefined behandelt werden');
    assert(!result10.includes('get?: undefined'), 'get sollte NICHT als undefined behandelt werden');
    
    assert(result10.includes('baseURL: string'), 'Sollte baseURL als string erkennen');
    assert(result10.includes('timeout: number'), 'Sollte timeout als number erkennen');
    assert(result10.includes('headers:'), 'Sollte headers Property enthalten');
  });

  // Test 11: KRITISCHER FEHLERFALL - axiosClient fehlt im Context, wird aber im Code verwendet
  runTest('Test 11: axiosClient fehlt im Context (Real-World Fehlerfall)', () => {
    // Simuliere den Fall aus dem Bild: Context hat nur console und QueryRetriever, aber kein axiosClient
    const contextWithoutAxios = {
      console: console,
      QueryRetriever: {
        test: "5"
      }
      // axiosClient fehlt hier absichtlich!
    };
    
    const result11 = TypeDefBuilder.buildContextLib('MissingAxiosTest', contextWithoutAxios);
    
    // KRITISCH: axiosClient sollte IMMER deklariert werden, auch wenn es nicht im Context ist
    // (wird häufig im Code verwendet, auch wenn nicht explizit im Context)
    assert(result11.includes('console'), 'Sollte console enthalten');
    assert(result11.includes('QueryRetriever'), 'Sollte QueryRetriever enthalten');
    
    // WICHTIG: axiosClient sollte trotzdem deklariert werden (für Monaco)
    assert(result11.includes('type axiosClient ='), 
      'Sollte axiosClient Typ deklarieren, auch wenn nicht im Context');
    assert(result11.includes('const axiosClient: axiosClient'), 
      'Sollte axiosClient const deklarieren, auch wenn nicht im Context');
    
    // Prüfe dass axiosClient die Standard-Methoden hat
    assert(result11.includes('post?: (...args: any[]) => Promise<any>'), 
      'axiosClient sollte post Methode haben, auch wenn nicht im Context');
    assert(result11.includes('get?: (...args: any[]) => Promise<any>'), 
      'axiosClient sollte get Methode haben, auch wenn nicht im Context');
  });

  console.log('');
  console.log('='.repeat(80));
  console.log(`Tests abgeschlossen: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen`);
  console.log('='.repeat(80));
  
  if (testsFailed > 0) {
    throw new Error(`${testsFailed} Test(s) fehlgeschlagen!`);
  }
  
  console.log('✅ Alle TypeDefBuilder Tests bestanden!');
}

// Führe Tests aus, wenn die Datei direkt ausgeführt wird
// In Node.js: ts-node ui/TypeDefBuilder.test.ts
if (typeof require !== 'undefined' && require.main === module) {
  testTypeDefBuilder();
}

// Exportiere auch die Assert-Funktion für externe Tests
export { assert };

