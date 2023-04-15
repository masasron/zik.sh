module.exports = {
    exportPathMap: async function (defaultPathMap) {
        return Object.assign(
            {},
            ...Object.keys(defaultPathMap).map((key) => {
                return {
                    [key === "/" ? "/index" : key]: {
                        page: key,
                    },
                };
            })
        );
    },
    trailingSlash: true
};