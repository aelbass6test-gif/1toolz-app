import { useState, useEffect } from 'react';

export const useInventoryVisibility = () => {
    const [showInventoryValue, setShowInventoryValue] = useState<boolean>(() => {
        const val = localStorage.getItem('show_inventory_value');
        if (val === null) return true;
        return val !== 'false';
    });

    useEffect(() => {
        const handleToggle = () => {
            const val = localStorage.getItem('show_inventory_value');
            setShowInventoryValue(val === null ? true : val !== 'false');
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
    const val = localStorage.getItem('show_inventory_value');
    return val === null ? true : val !== 'false';
};
