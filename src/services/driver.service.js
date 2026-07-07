const pool = require("../middleware/db.connection.js");

const getNearbyDriversForSocket =
async (
    latitude,
    longitude,
    radius_km = 100
) => {

    const result = await pool.query(
        `
        CALL public.get_nearby_drivers(
            $1,
            $2,
            $3,
            NULL
        )
        `,
        [
            latitude,
            longitude,
            radius_km
        ]
    );

    const response =
        result.rows[0]?.p_response;

    if (
        !response ||
        !response.success
    ) {
        return [];
    }

    return response.data || [];
};

module.exports = {
    getNearbyDriversForSocket
};