module.exports = {
  use: [
    [
      "neutrino-preset-conduit",
      {
        react: {
          html: {
            title: "Files"
          },
          devServer: {
            disableHostCheck: true,
            headers: { "Access-Control-Allow-Origin": "*" },
            compress: true,
            historyApiFallback: {
              disableDotRule: true
            }
          }
        }
      }
    ],
    neutrino => {
      // Hacks to replace react-hot-loader with latest version (v4)
      neutrino.config.entry("index").batch(index => {
        const values = index
          .values()
          .filter(value => !value.includes("react-hot-loader"));

        index.clear().merge(values);
      });

      neutrino.config.module
        .rule("compile")
        .use("babel")
        .tap(options => {
          options.plugins.forEach((plugin, index) => {
            if (Array.isArray(plugin)) {
              if (plugin[0].includes("react-hot-loader")) {
                plugin[0] = require.resolve("react-hot-loader/babel");
              }
            } else {
              if (plugin.includes("react-hot-loader")) {
                options.plugins[index] = require.resolve(
                  "react-hot-loader/babel"
                );
              }
            }
          });

          return options;
        });
    }
  ]
};
