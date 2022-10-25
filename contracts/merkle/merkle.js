const { MerkleTree } = require('merkletreejs')
const keccak256 = require('keccak256')
const { parse } = require('csv-parse')
const fs = require('fs')
const path = require('path')
const ethers = require('ethers')
const createCsvWriter = require('csv-writer').createArrayCsvWriter;




async function parseCSV() {
    return new Promise((resolve, reject) => {
      const sourcePath = path.resolve('./merkle/whitelist.csv')
      if (!sourcePath) reject("whitelist csv file not found.")
      const walletAddresses = []
      const times = []
      const leafHashes = []
      let onboardingDate, timestamp;
      console.info("Reading whitelists")
      fs.createReadStream(sourcePath)
        .pipe(parse())
        .on('data', (row) => {
          const [walletAddress, onboardingTime] = row
          //排除文件头
          if (row.includes("address") || row.includes("onboardingTime")) return
          walletAddresses.push(walletAddress)
          /*convert 2022-10-1 to Unix Timestamp*/
          onboardingDate = new Date(onboardingTime);
          //to second
          timestamp = onboardingDate.getTime() / 1000;
          times.push(timestamp);
          //cal hash
          //console.log("walletAddress is ", walletAddress, "onboardingTime is ", onboardingTime.toString(), "timeStamp is ", timestamp)
          const leaf = ethers.utils.solidityPack(["address", "uint256"], [walletAddress, timestamp])

          leafHashes.push(leaf)
        })
        .on('end', () => {
          console.log('whitelist file successfully processed');
          resolve([walletAddresses, times, leafHashes])
        });
    })
}

function generateMerkleTree(leaves = []) {
    const leafHashes = leaves.map(x => keccak256(x))
    const tree = new MerkleTree(leafHashes, keccak256, { sort: true })
    return tree;
}

function getProof(tree, leave) {
  const leaf = keccak256(leave);
  const proof = tree.getHexProof(leaf);
  
  return proof;
}

function verify(tree, leaf, proof) {
  const root = tree.getHexRoot();
  const leafHash = keccak256(leaf);
  return tree.verify(proof, leafHash, root);
}

async function writeFile(addresses, times, proofs) {
  let columns = [
    'address',
    'onboardingTime',
    'proof'
  ];

  let details = new Array();
  const len = addresses.length;

  for (i = 0; i < len; i++) {
    details.push([addresses[i], times[i], proofs[i]]);
  }

  const filename = "proofs.csv";
  const csvWriter = createCsvWriter({
      header: columns,
      path: filename
  });

  csvWriter.writeRecords(details)
      .then(() => {
          console.log('...Done');
      })
      .catch((e) => {
        console.log(e);
      })
}




async function main() {
    let proofs = new Array();
    const [addresses, times, leafhashes] = await parseCSV()
    const tree = generateMerkleTree(leafhashes)

    const root = tree.getHexRoot()

    /*
    const proof = getProof(tree, leafhashes[0])

    console.log(verify(tree, leafhashes[0], proof)) // true
    console.log(verify(tree, leafhashes[1], proof))  // false
    */
    for (i = 0; i < addresses.length; i++) {
      proofs.push(getProof(tree, leafhashes[i]));
    }

    //写文件
    await writeFile(addresses, times, proofs);
}

module.exports = {
  getProof,
  generateMerkleTree,
  verify
}



main()
  .then()



