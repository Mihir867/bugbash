export type Anchor = {
  address: "CT2TbWY3ny6wn6jRq3RPdqh4gnmtupzNhdJHeWCkzaKw";
  metadata: {
    name: "anchor";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "initialize";
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [];
      args: [];
    },
    {
      name: "storeVulnerabilityReport";
      discriminator: [147, 203, 45, 28, 91, 156, 78, 142];
      accounts: [
        {
          name: "vulnerabilityReport";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  118,
                  117,
                  108,
                  110,
                  101,
                  114,
                  97,
                  98,
                  105,
                  108,
                  105,
                  116,
                  121,
                  95,
                  114,
                  101,
                  112,
                  111,
                  114,
                  116
                ];
              },
              {
                kind: "account";
                path: "reporter";
              },
              {
                kind: "arg";
                path: "repositoryId";
              }
            ];
          };
        },
        {
          name: "reporter";
          writable: true;
          signer: true;
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "repositoryId";
          type: "string";
        },
        {
          name: "reportUrl";
          type: "string";
        }
      ];
    },
    {
      name: "mintSecurityBadgeNft";
      discriminator: [92, 187, 34, 215, 78, 43, 156, 201];
      accounts: [
        {
          name: "vulnerabilityReport";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  118,
                  117,
                  108,
                  110,
                  101,
                  114,
                  97,
                  98,
                  105,
                  108,
                  105,
                  116,
                  121,
                  95,
                  114,
                  101,
                  112,
                  111,
                  114,
                  116
                ];
              },
              {
                kind: "account";
                path: "reporter";
              },
              {
                kind: "arg";
                path: "repositoryId";
              }
            ];
          };
        },
        {
          name: "mint";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 105, 110, 116];
              },
              {
                kind: "account";
                path: "reporter";
              },
              {
                kind: "arg";
                path: "repositoryId";
              }
            ];
          };
        },
        {
          name: "tokenAccount";
          writable: true;
        },
        {
          name: "metadata";
          writable: true;
        },
        {
          name: "reporter";
          writable: true;
          signer: true;
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "tokenMetadataProgram";
          address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
        }
      ];
      args: [
        {
          name: "repositoryId";
          type: "string";
        },
        {
          name: "metadataTitle";
          type: "string";
        },
        {
          name: "metadataSymbol";
          type: "string";
        },
        {
          name: "metadataUri";
          type: "string";
        }
      ];
    },
    {
      name: "storeVulnerabilityReportAndMintNft";
      discriminator: [198, 53, 220, 241, 57, 53, 186, 5];
      accounts: [
        {
          name: "vulnerabilityReport";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  118,
                  117,
                  108,
                  110,
                  101,
                  114,
                  97,
                  98,
                  105,
                  108,
                  105,
                  116,
                  121,
                  95,
                  114,
                  101,
                  112,
                  111,
                  114,
                  116
                ];
              },
              {
                kind: "account";
                path: "reporter";
              },
              {
                kind: "arg";
                path: "repositoryId";
              }
            ];
          };
        },
        {
          name: "mint";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 105, 110, 116];
              },
              {
                kind: "account";
                path: "reporter";
              },
              {
                kind: "arg";
                path: "repositoryId";
              }
            ];
          };
        },
        {
          name: "tokenAccount";
          writable: true;
        },
        {
          name: "metadata";
          writable: true;
        },
        {
          name: "reporter";
          writable: true;
          signer: true;
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "tokenMetadataProgram";
          address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
        }
      ];
      args: [
        {
          name: "repositoryId";
          type: "string";
        },
        {
          name: "reportUrl";
          type: "string";
        },
        {
          name: "metadataTitle";
          type: "string";
        },
        {
          name: "metadataSymbol";
          type: "string";
        },
        {
          name: "metadataUri";
          type: "string";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "vulnerabilityReport";
      discriminator: [219, 119, 63, 125, 101, 147, 0, 122];
    }
  ];
  types: [
    {
      name: "vulnerabilityReport";
      type: {
        kind: "struct";
        fields: [
          {
            name: "repositoryId";
            type: "string";
          },
          {
            name: "reportUrl";
            type: "string";
          },
          {
            name: "reporter";
            type: "pubkey";
          },
          {
            name: "timestamp";
            type: "i64";
          },
          {
            name: "nftMint";
            type: "pubkey";
          }
        ];
      };
    }
  ];
};
