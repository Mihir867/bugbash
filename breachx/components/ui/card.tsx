import React from 'react';

const Card = () => {
    return (
        <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-xl font-bold mb-2">Card Title</h2>
            <p className="text-gray-600">Card content goes here.</p>
        </div>
    );
};

const BentoGrid = () => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <Card />
            <Card />
            <Card />
            <Card />
        </div>
    );
};

export default BentoGrid;