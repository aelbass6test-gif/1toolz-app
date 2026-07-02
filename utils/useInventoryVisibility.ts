import { useState, useEffect } from 'react';

export const useInventoryVisibility = () => {
    const [showInventoryValue, setShowInventoryValue] = useState<boolean>(() => {
        return localStorage.getItem('show_inventory_value') !== 'false';
    });

    useEffect(() => {
        const handleToggle = () => {
            setShowInventoryValue(localStorage.getItem('show_inventory_value') !== 'false');
        };
        window.addEventListener('inventory_value_toggled', handleToggle);
        return () => window.removeEventListener('inventory_value_toggled', handleToggle);
    }, []);

    const toggleInventoryValue = () => {
        setShowInventoryValue(prev => {
            const next = !prev;
            localStorage.setItem('show_inventory_value', String(next));
            window.dispatchEvent(new Event('inventory_value_toggled'));
            return next;
        });
    };

    return { showInventoryValue, toggleInventoryValue, setShowInventoryValue };
};

export const getShowInventoryValue = (): boolean => {
    return localStorage.getItem('show_inventory_value') !== 'false';
};
