#include <Firebase_ESP_Client.h>
#include <WiFi.h>
#include <vector>


// 1. DATABASE & NETWORK CONFIGURATION
#define WIFI_SSID "YOUR_WIFI_NAME"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define API_KEY "AIzaSyDnOqNF8U-uNKDQEZiR0AyMd6JAbFNEIFE"
#define DATABASE_URL                                                           \
  "https://cartpunch-5b2d8-default-rtdb.asia-southeast1.firebasedatabase.app/"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ==========================================
// 2. STATE & SESSION MANAGEMENT
// ==========================================
// Structure to hold individual item data and quantities
struct CartItem {
  String barcode;
  String name;
  float price;
  int quantity;
};

std::vector<CartItem> activeCart; // Stores all scanned items in current session
float maxBudget = 0.0;
float currentTotal = 0.0;
bool sessionActive = false;

// Hardware Pins
#define RXD2_SCANNER 16
#define TXD2_SCANNER 17
#define RXD1_DISPLAY 18
#define TXD1_DISPLAY 19

void setup() {
  Serial.begin(115200);
  Serial1.begin(9600, SERIAL_8N1, RXD1_DISPLAY, TXD1_DISPLAY); // Display UI
  Serial2.begin(9600, SERIAL_8N1, RXD2_SCANNER,
                TXD2_SCANNER); // Barcode Scanner

  // Connect Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  // Connect Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.tokens.legacy_token = "";
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

// ==========================================
// 4. HARDWARE INTERFACE LISTENER & API
// ==========================================
void loop() {
  // A. Listen for UI Commands (e.g., Setting Budget, Updating Qty)
  if (Serial1.available()) {
    String uiCmd = Serial1.readStringUntil('\n');
    uiCmd.trim();
    processUICommand(uiCmd);
  }

  // B. Listen for Barcode Scans
  if (Serial2.available()) {
    String scannedBarcode = Serial2.readStringUntil('\r');
    scannedBarcode.trim();
    if (scannedBarcode.length() > 0 && sessionActive) {
      lookupAndProcessItem(scannedBarcode);
    }
  }
}

// Process commands sent from the front-end UI
void processUICommand(String cmd) {
  if (cmd.startsWith("SET_BUDGET:")) {
    maxBudget = cmd.substring(11).toFloat();
    sessionActive = true;
    activeCart.clear();
    currentTotal = 0.0;
    Serial.println("Session Started. Budget: " + String(maxBudget));
  } else if (cmd.startsWith("UPDATE_QTY:")) {
    // Format: UPDATE_QTY:Barcode:NewQuantity (e.g., UPDATE_QTY:48060262:2)
    int firstColon = cmd.indexOf(':', 11);
    String bCode = cmd.substring(11, firstColon);
    int newQty = cmd.substring(firstColon + 1).toInt();
    updateItemQuantity(bCode, newQty);
  } else if (cmd == "CHECKOUT") {
    saveTransactionToLedger();
    sessionActive = false;
  }
}

// ==========================================
// 3. BUSINESS LOGIC & COMPUTATION ENGINE
// ==========================================
void lookupAndProcessItem(String barcode) {
  String itemName = "";
  float itemPrice = 0.0;

  // Search Firebase for Product
  if (Firebase.ready()) {
    String path = "/products/" + barcode;
    if (Firebase.RTDB.getString(&fbdo, path + "/name"))
      itemName = fbdo.stringData();
    if (Firebase.RTDB.getFloat(&fbdo, path + "/price"))
      itemPrice = fbdo.floatData();
  }

  if (itemName != "") {
    // RUN THE OVER-BUDGET INTERCEPTOR
    if (currentTotal + itemPrice > maxBudget) {
      sendToDisplay("TRIGGER:LIMIT_REACHED");
      sendToDisplay("VAR:ItemToAdd=" + String(itemPrice));
      sendToDisplay("VAR:NewTotal=" + String(currentTotal + itemPrice));
      Serial.println("BLOCKED: Adding this item exceeds the budget!");
      return; // Stop the function here so the item is NOT added
    }

    // Check if item already exists in cart, if so, just increase quantity
    bool found = false;
    for (int i = 0; i < activeCart.size(); i++) {
      if (activeCart[i].barcode == barcode) {
        activeCart[i].quantity++;
        found = true;
        break;
      }
    }

    // If new item, add to array
    if (!found) {
      activeCart.push_back({barcode, itemName, itemPrice, 1});
    }

    // Recalculate totals
    recalculateCartTotals();
  }
}

void updateItemQuantity(String barcode, int newQty) {
  for (int i = 0; i < activeCart.size(); i++) {
    if (activeCart[i].barcode == barcode) {
      // OVER-BUDGET INTERCEPTOR FOR QTY PAD
      float priceDifference =
          (newQty - activeCart[i].quantity) * activeCart[i].price;
      if (currentTotal + priceDifference > maxBudget) {
        sendToDisplay("TRIGGER:LIMIT_REACHED");
        return;
      }

      activeCart[i].quantity = newQty;
      if (activeCart[i].quantity <= 0) {
        activeCart.erase(activeCart.begin() + i); // Remove item if Qty is 0
      }
      break;
    }
  }
  recalculateCartTotals();
}

void recalculateCartTotals() {
  currentTotal = 0.0;
  bool warningTriggered = false;

  for (int i = 0; i < activeCart.size(); i++) {
    currentTotal += (activeCart[i].price * activeCart[i].quantity);
  }

  // THRESHOLD ALERT ENGINE (70% Warning)
  if (currentTotal >= (maxBudget * 0.70)) {
    warningTriggered = true;
    sendToDisplay("TRIGGER:WARNING_70_PERCENT");
  }

  // Send Updated Data to Front-End
  sendToDisplay("UI_UPDATE:Total=" + String(currentTotal));
  sendToDisplay("UI_UPDATE:Remaining=" + String(maxBudget - currentTotal));
}

// ==========================================
// 1B. TRANSACTION LEDGER SAVING
// ==========================================
void saveTransactionToLedger() {
  if (Firebase.ready()) {
    String sessionID = String(millis()); // Generate a simple unique ID
    String path = "/transactions/txn_" + sessionID;

    Firebase.RTDB.setFloat(&fbdo, path + "/totalSpent", currentTotal);
    Firebase.RTDB.setFloat(&fbdo, path + "/maxBudget", maxBudget);

    for (int i = 0; i < activeCart.size(); i++) {
      Firebase.RTDB.setString(&fbdo,
                              path + "/items/item_" + String(i) + "/name",
                              activeCart[i].name);
      Firebase.RTDB.setInt(&fbdo, path + "/items/item_" + String(i) + "/qty",
                           activeCart[i].quantity);
    }
    Serial.println("Transaction successfully saved to Firebase Ledger.");
  }
}

// Helper to send data to the Front-End Screen
void sendToDisplay(String cmd) {
  Serial1.print(cmd);
  Serial1.write(0xFF);
  Serial1.write(0xFF);
  Serial1.write(0xFF);
}