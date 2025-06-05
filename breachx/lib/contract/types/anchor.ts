export type Anchor = {
  address: "gK7LKdzB7mKMHGg7Tio7Yatjhrb6V3yAGkYTqbTSoKz";
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
      discriminator: [197, 52, 219, 240, 56, 52, 185, 4];
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
          }
        ];
      };
    }
  ];
};
