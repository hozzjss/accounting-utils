const process = require("process");
const { sourcecred } = require("sourcecred");
const { Ledger } = sourcecred.ledger.ledger;
const fs = require("fs");
const path = require("path");

const createLedgerDiskStorage = (ledgerFilePath) => ({
  read: async () => {
    return Ledger.parse(fs.readFileSync(ledgerFilePath).toString());
  },
  write: async (ledger) => {
    fs.writeFileSync(ledgerFilePath, ledger.serialize());
  },
});

const [, , treasuryAccountName, ledgerPath, csvFilePath, txUrl] = process.argv;
const { LedgerManager } = sourcecred.ledger.manager;

const diskStorage = createLedgerDiskStorage(path.resolve(ledgerPath));
const ledgerManager = new LedgerManager({
  storage: diskStorage,
});

const getIdByName = (name) =>
  ledgerManager.ledger.accountByName(name)?.identity.id;

const main = async () => {
  const ledgerResult = await ledgerManager.reloadLedger();
  if (ledgerResult.error) {
    return {
      type: "FAILURE",
      error: `Error processing ledger events: ${ledgerResult.error}`,
    };
  }

  const csvString = fs.readFileSync(path.resolve(csvFilePath)).toString();

  for (let line of csvString.split("\n")) {
    const [name, amount] = line.split(",");
    ledgerManager.ledger.transferGrain({
      to: getIdByName(treasuryAccountName),
      amount: (Number(amount) * 10e17).toLocaleString("fullwide", {
        useGrouping: false,
      }),
      from: getIdByName(name),
      memo: txUrl,
    });
  }

  await ledgerManager.persist();
};

main();
