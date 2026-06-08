'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageContainer } from '../components/page-container'
import { CurrencyInput } from '../components/currency-input'
import { Toast } from '../components/ui/toast'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { supabase } from '../../lib/supabase'
import { Eye, FileText, ImageIcon, Pencil, Star, Trash2, Upload } from 'lucide-react'

type Brand = {
    id: string
    name: string
}

type VehicleModel = {
    id: string
    name: string
    brand_id: string
}

type SimpleOption = {
    id: string
    name: string
}

type VehicleFile = {
    id: string
    vehicle_id: string
    file_name: string
    file_path: string
    file_type: 'IMAGE' | 'PDF'
    file_size: number | null
    mime_type: string | null
}

type PendingFile = {
    localId: string
    file: File
    fileType: 'IMAGE' | 'PDF'
}

type Vehicle = {
    id: string
    plate: string
    brand_id: string | null
    model_id: string | null
    category_id: string | null
    engine_id: string | null
    transmission_id: string | null
    fuel_id: string | null
    color_id: string | null
    manufacture_year: number | null
    model_year: number | null
    km: number | null
    purchase_price: number
    advertised_price: number
    chassi: string | null
    renavam: string | null
    notes: string | null
    status: string
    is_published: boolean
    main_photo_file_id: string | null
    brands?: { name: string } | null
    vehicle_models?: { name: string } | null
    vehicle_categories?: { name: string } | null
    engines?: { name: string } | null
    transmissions?: { name: string } | null
    fuels?: { name: string } | null
    colors?: { name: string } | null
}

const statusOptions = [
    { label: 'Em estoque', value: 'EM_ESTOQUE' },
    { label: 'Reservado', value: 'RESERVADO' },
    { label: 'Vendido', value: 'VENDIDO' },
]

function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    })
}

function parseCurrency(value: string) {
    const onlyNumbers = value.replace(/\D/g, '')
    return Number(onlyNumbers) / 100
}

function createVehicleFilePath(vehicleId: string, fileName: string) {
    return `${vehicleId}/${Date.now()}-${fileName}`
}

function formatChassi(value: string) {
    return value.toUpperCase().replace(/\s/g, '').slice(0, 17)
}

function formatRenavam(value: string) {
    return value.replace(/\D/g, '').slice(0, 11)
}

function formatFileSize(size?: number | null) {
    if (!size) return '-'

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1).replace('.', ',')} KB`
    }

    return `${(size / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

function getStatusLabel(status: string) {
    return statusOptions.find((item) => item.value === status)?.label || status
}

function getStatusClass(status: string) {
    switch (status) {
        case 'EM_ESTOQUE':
            return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
        case 'RESERVADO':
            return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
        case 'VENDIDO':
            return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
        default:
            return 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200'
    }
}

export default function VeiculosPage() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [brands, setBrands] = useState<Brand[]>([])
    const [models, setModels] = useState<VehicleModel[]>([])

    const [engines, setEngines] = useState<SimpleOption[]>([])
    const [transmissions, setTransmissions] = useState<SimpleOption[]>([])
    const [fuels, setFuels] = useState<SimpleOption[]>([])
    const [colors, setColors] = useState<SimpleOption[]>([])
    const [categories, setCategories] = useState<SimpleOption[]>([])

    const [showForm, setShowForm] = useState(false)
    const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)

    const [plate, setPlate] = useState('')
    const [brandId, setBrandId] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [modelId, setModelId] = useState('')
    const [engineId, setEngineId] = useState('')
    const [transmissionId, setTransmissionId] = useState('')
    const [fuelId, setFuelId] = useState('')
    const [colorId, setColorId] = useState('')
    const [manufactureYear, setManufactureYear] = useState('')
    const [modelYear, setModelYear] = useState('')
    const [km, setKm] = useState('')
    const [purchasePrice, setPurchasePrice] = useState('')
    const [advertisedPrice, setAdvertisedPrice] = useState('')
    const [chassi, setChassi] = useState('')
    const [renavam, setRenavam] = useState('')
    const [notes, setNotes] = useState('')
    const [status, setStatus] = useState('EM_ESTOQUE')

    const [loading, setLoading] = useState(false)
    const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    const [vehicleFiles, setVehicleFiles] = useState<VehicleFile[]>([])
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
    const [uploading, setUploading] = useState(false)
    const [deleteFile, setDeleteFile] = useState<VehicleFile | null>(null)
    const [deleteFileLoading, setDeleteFileLoading] = useState(false)

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [isPublished, setIsPublished] = useState(false)
    const [mainPhotoFileId, setMainPhotoFileId] = useState<string | null>(null)
    const [publishedFilter, setPublishedFilter] = useState('')

    const [toast, setToast] = useState({
        open: false,
        type: 'success' as 'success' | 'error',
        title: '',
        description: '',
    })

    const filteredModels = models.filter((model) => model.brand_id === brandId)
    const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)

    const publishedVehiclesCount = vehicles.filter((vehicle) => vehicle.is_published).length

    const filteredVehicles = vehicles.filter((vehicle) => {
        const brandName = vehicle.brands?.name || ''
        const modelName = vehicle.vehicle_models?.name || ''
        const colorName = vehicle.colors?.name || ''
        const categoryName = vehicle.vehicle_categories?.name || ''
        const matchesPublished =
            publishedFilter === ''
                ? true
                : publishedFilter === 'PUBLICADO'
                    ? vehicle.is_published === true
                    : vehicle.is_published !== true

        const matchesSearch =
            vehicle.plate.toLowerCase().includes(search.toLowerCase()) ||
            brandName.toLowerCase().includes(search.toLowerCase()) ||
            modelName.toLowerCase().includes(search.toLowerCase()) ||
            colorName.toLowerCase().includes(search.toLowerCase()) ||
            categoryName.toLowerCase().includes(search.toLowerCase()) ||
            (vehicle.chassi || '').toLowerCase().includes(search.toLowerCase()) ||
            (vehicle.renavam || '').toLowerCase().includes(search.toLowerCase())

        const matchesStatus = statusFilter ? vehicle.status === statusFilter : true

        return matchesSearch && matchesStatus && matchesPublished
    })

    function showToast(
        type: 'success' | 'error',
        title: string,
        description?: string
    ) {
        setToast({
            open: true,
            type,
            title,
            description: description || '',
        })

        setTimeout(() => {
            setToast((current) => ({ ...current, open: false }))
        }, 3000)
    }

    function resetForm() {
        setEditingVehicleId(null)
        setPlate('')
        setBrandId('')
        setCategoryId('')
        setModelId('')
        setEngineId('')
        setTransmissionId('')
        setFuelId('')
        setColorId('')
        setManufactureYear('')
        setModelYear('')
        setKm('')
        setPurchasePrice('')
        setAdvertisedPrice('')
        setChassi('')
        setRenavam('')
        setNotes('')
        setIsPublished(false)
        setMainPhotoFileId(null)
        setStatus('EM_ESTOQUE')
        setVehicleFiles([])
        setPendingFiles([])
        setDeleteFile(null)
    }

    async function loadBrands() {
        const { data, error } = await supabase
            .from('brands')
            .select('id, name')
            .order('name')

        if (error) {
            showToast('error', 'Erro', 'Não foi possível carregar as marcas.')
            return
        }

        setBrands(data || [])
    }

    async function loadModels() {
        const { data, error } = await supabase
            .from('vehicle_models')
            .select('id, name, brand_id')
            .order('name')

        if (error) {
            showToast('error', 'Erro', 'Não foi possível carregar os modelos.')
            return
        }

        setModels(data || [])
    }

    async function loadOptions() {
        const [enginesRes, transmissionsRes, fuelsRes, colorsRes, categoriesRes] =
            await Promise.all([
                supabase.from('engines').select('id, name').order('name'),
                supabase.from('transmissions').select('id, name').order('name'),
                supabase.from('fuels').select('id, name').order('name'),
                supabase.from('colors').select('id, name').order('name'),
                supabase.from('vehicle_categories').select('id, name').order('name'),
            ])

        if (enginesRes.error) {
            showToast('error', 'Erro', 'Não foi possível carregar os motores.')
        }

        if (transmissionsRes.error) {
            showToast('error', 'Erro', 'Não foi possível carregar os câmbios.')
        }

        if (fuelsRes.error) {
            showToast('error', 'Erro', 'Não foi possível carregar os combustíveis.')
        }

        if (colorsRes.error) {
            showToast('error', 'Erro', 'Não foi possível carregar as cores.')
        }

        if (categoriesRes.error) {
            showToast('error', 'Erro', 'Não foi possível carregar as categorias.')
        }

        setEngines(enginesRes.data || [])
        setTransmissions(transmissionsRes.data || [])
        setFuels(fuelsRes.data || [])
        setColors(colorsRes.data || [])
        setCategories(categoriesRes.data || [])
    }

    async function loadVehicles() {
        const { data, error } = await supabase
            .from('vehicles')
            .select(`
        id,
        plate,
        brand_id,
        model_id,
        engine_id,
        transmission_id,
        fuel_id,
        color_id,
        manufacture_year,
        model_year,
        category_id,
        vehicle_categories(name),
        km,
        purchase_price,
        advertised_price,
        chassi,
        renavam,
        notes,
        status,
        main_photo_file_id,
        is_published,
        brands(name),
        vehicle_models(name),
        engines(name),
        transmissions(name),
        fuels(name),
        colors(name)
      `)
            .order('created_at', { ascending: false })

        if (error) {
            showToast('error', 'Erro', error.message)
            return
        }

        setVehicles((data || []) as unknown as Vehicle[])
    }

    useEffect(() => {
        async function loadInitialData() {
            await Promise.all([
                loadBrands(),
                loadModels(),
                loadOptions(),
                loadVehicles(),
            ])
        }

        void loadInitialData()
    }, [])

    function handleBrandChange(value: string) {
        setBrandId(value)
        setModelId('')
    }

    function handleAddPendingFile(file: File, fileType: 'IMAGE' | 'PDF') {
        if (fileType === 'PDF' && file.size > 10 * 1024 * 1024) {
            showToast('error', 'Arquivo muito grande', 'O PDF deve ter no máximo 10MB.')
            return
        }

        if (fileType === 'IMAGE' && file.size > 8 * 1024 * 1024) {
            showToast('error', 'Imagem muito grande', 'A imagem deve ter no máximo 8MB.')
            return
        }

        setPendingFiles((current) => [
            ...current,
            {
                localId: `${Date.now()}-${Math.random()}`,
                file,
                fileType,
            },
        ])
    }

    async function compressImage(file: File): Promise<File> {
        return new Promise((resolve, reject) => {
            const image = new Image()
            const reader = new FileReader()

            reader.onload = () => {
                image.src = String(reader.result)
            }

            image.onload = () => {
                const canvas = document.createElement('canvas')
                const maxWidth = 1280
                const scale = Math.min(1, maxWidth / image.width)

                canvas.width = Math.round(image.width * scale)
                canvas.height = Math.round(image.height * scale)

                const ctx = canvas.getContext('2d')

                if (!ctx) {
                    resolve(file)
                    return
                }

                ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve(file)
                            return
                        }

                        resolve(
                            new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                                type: 'image/webp',
                                lastModified: Date.now(),
                            })
                        )
                    },
                    'image/webp',
                    0.85
                )
            }

            image.onerror = reject
            reader.onerror = reject
            reader.readAsDataURL(file)
        })
    }

    async function handleUploadFileToVehicle(
        vehicleId: string,
        file: File,
        fileType: 'IMAGE' | 'PDF'
    ): Promise<VehicleFile | null> {
        const bucket = fileType === 'IMAGE' ? 'vehicle-images' : 'vehicle-documents'
        const finalFile = fileType === 'IMAGE' ? await compressImage(file) : file

        const safeFileName = finalFile.name
            .toLowerCase()
            .replace(/\s/g, '-')
            .replace(/[^a-z0-9.-]/g, '')

        const filePath = createVehicleFilePath(vehicleId, safeFileName)

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, finalFile, {
                cacheControl: '3600',
                upsert: false,
            })

        if (uploadError) {
            throw new Error(uploadError.message)
        }

        const { data, error: insertError } = await supabase
            .from('vehicle_files')
            .insert({
                vehicle_id: vehicleId,
                file_name: finalFile.name,
                file_path: filePath,
                file_type: fileType,
                file_size: finalFile.size,
                mime_type: finalFile.type,
            })
            .select('id, vehicle_id, file_name, file_path, file_type, file_size, mime_type')
            .single()

        if (insertError) {
            await supabase.storage.from(bucket).remove([filePath])
            throw new Error(insertError.message)
        }

        return data as VehicleFile
    }

    async function uploadPendingFiles(vehicleId: string) {
        if (pendingFiles.length === 0) return

        setUploading(true)

        try {
            let firstUploadedImageId: string | null = null

            for (const item of pendingFiles) {
                const uploadedFile = await handleUploadFileToVehicle(
                    vehicleId,
                    item.file,
                    item.fileType
                )

                if (
                    item.fileType === 'IMAGE' &&
                    uploadedFile?.id &&
                    !firstUploadedImageId
                ) {
                    firstUploadedImageId = uploadedFile.id
                }
            }

            if (!mainPhotoFileId && firstUploadedImageId) {
                const { error } = await supabase
                    .from('vehicles')
                    .update({
                        main_photo_file_id: firstUploadedImageId,
                    })
                    .eq('id', vehicleId)

                if (!error) {
                    setMainPhotoFileId(firstUploadedImageId)
                }
            }

            setPendingFiles([])
            await loadVehicleFiles(vehicleId)
        } catch (error) {
            showToast(
                'error',
                'Erro ao enviar arquivo',
                error instanceof Error ? error.message : 'Não foi possível enviar o arquivo.'
            )
        } finally {
            setUploading(false)
        }
    }

    async function loadVehicleFiles(vehicleId: string) {
        const { data, error } = await supabase
            .from('vehicle_files')
            .select('id, vehicle_id, file_name, file_path, file_type, file_size, mime_type')
            .eq('vehicle_id', vehicleId)
            .order('created_at', { ascending: false })

        if (error) {
            showToast('error', 'Erro', 'Não foi possível carregar os arquivos.')
            return
        }

        setVehicleFiles((data || []) as VehicleFile[])
    }

    function getPublicFileUrl(file: VehicleFile) {
        const bucket = file.file_type === 'IMAGE' ? 'vehicle-images' : 'vehicle-documents'
        const { data } = supabase.storage.from(bucket).getPublicUrl(file.file_path)

        return data.publicUrl
    }


    async function handleSaveVehicle() {
        if (!plate.trim()) {
            showToast('error', 'Campo obrigatório', 'Informe a placa do veículo.')
            return
        }

        if (!brandId) {
            showToast('error', 'Campo obrigatório', 'Selecione a marca do veículo.')
            return
        }

        if (!modelId) {
            showToast('error', 'Campo obrigatório', 'Selecione o modelo do veículo.')
            return
        }

        if (!colorId) {
            showToast('error', 'Campo obrigatório', 'Selecione a cor do veículo.')
            return
        }

        if (chassi && chassi.length !== 17) {
            showToast(
                'error',
                'Chassi inválido',
                'O chassi deve possuir exatamente 17 caracteres.'
            )
            return
        }

        if (renavam && renavam.length !== 11) {
            showToast(
                'error',
                'Renavam inválido',
                'O Renavam deve possuir exatamente 11 dígitos.'
            )
            return
        }

        setLoading(true)

        const finalIsPublished = status === 'VENDIDO' ? false : isPublished
        const vehicleData = {
            plate: plate.trim().toUpperCase(),
            brand_id: brandId,
            category_id: categoryId || null,
            model_id: modelId,
            engine_id: engineId || null,
            transmission_id: transmissionId || null,
            fuel_id: fuelId || null,
            color_id: colorId,
            manufacture_year: manufactureYear ? Number(manufactureYear) : null,
            model_year: modelYear ? Number(modelYear) : null,
            km: km ? Number(km) : null,
            purchase_price: purchasePrice ? parseCurrency(purchasePrice) : 0,
            advertised_price: advertisedPrice ? parseCurrency(advertisedPrice) : 0,
            chassi: chassi || null,
            renavam: renavam || null,
            notes: notes.trim() || null,
            is_published: finalIsPublished,
            main_photo_file_id: mainPhotoFileId,
            status,
        }

        if (editingVehicleId) {
            const { error } = await supabase
                .from('vehicles')
                .update(vehicleData)
                .eq('id', editingVehicleId)

            if (error) {
                showToast('error', 'Erro ao editar veículo', error.message)
                setLoading(false)
                return
            }

            if (pendingFiles.length > 0) {
                await uploadPendingFiles(editingVehicleId)
            } else {
                await loadVehicleFiles(editingVehicleId)
            }

            await loadVehicles()

            setPendingFiles([])
            setLoading(false)

            showToast(
                'success',
                'Veículo atualizado',
                'As alterações foram salvas. A tela continua aberta para ajustar fotos e foto principal.'
            )

            return
        }

        const { data, error } = await supabase
            .from('vehicles')
            .insert(vehicleData)
            .select('id')
            .single()

        if (error) {
            showToast('error', 'Erro ao cadastrar veículo', error.message)
            setLoading(false)
            return
        }

        if (data?.id && pendingFiles.length > 0) {
            await uploadPendingFiles(data.id)
        }

        showToast(
            'success',
            'Veículo cadastrado',
            'O veículo foi cadastrado. A tela continuará aberta para ajustar fotos e definir a principal.'
        )

        setEditingVehicleId(data.id)
        await loadVehicles()
        await loadVehicleFiles(data.id)
        setPendingFiles([])
        setLoading(false)
        return
    }

    function handleEditVehicle(vehicle: Vehicle) {
            setEditingVehicleId(vehicle.id)
            setPlate(vehicle.plate)
            setBrandId(vehicle.brand_id || '')
            setCategoryId(vehicle.category_id || '')
            setModelId(vehicle.model_id || '')
            setEngineId(vehicle.engine_id || '')
            setTransmissionId(vehicle.transmission_id || '')
            setFuelId(vehicle.fuel_id || '')
            setColorId(vehicle.color_id || '')
            setManufactureYear(vehicle.manufacture_year ? String(vehicle.manufacture_year) : '')
            setModelYear(vehicle.model_year ? String(vehicle.model_year) : '')
            setKm(vehicle.km ? String(vehicle.km) : '')
            setPurchasePrice(formatCurrency(Number(vehicle.purchase_price || 0)))
            setAdvertisedPrice(formatCurrency(Number(vehicle.advertised_price || 0)))
            setChassi(vehicle.chassi || '')
            setRenavam(vehicle.renavam || '')
            setNotes(vehicle.notes || '')
            setStatus(vehicle.status)
            setPendingFiles([])
            setShowForm(true)
            setIsPublished(vehicle.is_published || false)
            setMainPhotoFileId(vehicle.main_photo_file_id || null)
            void loadVehicleFiles(vehicle.id)
        }

        async function handleDeleteVehicle() {
            if (!deleteVehicleId) return

            setDeleteLoading(true)

            const { error } = await supabase
                .from('vehicles')
                .delete()
                .eq('id', deleteVehicleId)

            if (error) {
                showToast('error', 'Erro', 'Não foi possível excluir o veículo.')
                setDeleteLoading(false)
                return
            }

            showToast('success', 'Veículo excluído', 'O veículo foi removido com sucesso.')
            setDeleteVehicleId(null)
            setDeleteLoading(false)
            await loadVehicles()
        }

        async function handleDeleteFile() {
            if (!deleteFile) return

            setDeleteFileLoading(true)

            const bucket = deleteFile.file_type === 'IMAGE' ? 'vehicle-images' : 'vehicle-documents'

            await supabase.storage.from(bucket).remove([deleteFile.file_path])

            const { error } = await supabase
                .from('vehicle_files')
                .delete()
                .eq('id', deleteFile.id)

            if (error) {
                showToast('error', 'Erro', error.message)
                setDeleteFileLoading(false)
                return
            }

            showToast('success', 'Arquivo excluído', 'Arquivo removido com sucesso.')
            setDeleteFile(null)
            setDeleteFileLoading(false)

            if (editingVehicleId) {
                await loadVehicleFiles(editingVehicleId)
            }
        }

        const editingVehicle = editingVehicleId
            ? vehicles.find((vehicle) => vehicle.id === editingVehicleId)
            : null

        const pendingImages = pendingFiles.filter((file) => file.fileType === 'IMAGE')
        const pendingDocuments = pendingFiles.filter((file) => file.fileType === 'PDF')
        const savedImages = vehicleFiles.filter((file) => file.file_type === 'IMAGE')
        const savedDocuments = vehicleFiles.filter((file) => file.file_type === 'PDF')

        async function handleSetMainPhoto(fileId: string) {
            setMainPhotoFileId(fileId)

            if (!editingVehicleId) {
                showToast(
                    'success',
                    'Foto principal selecionada',
                    'Ao salvar o veículo, essa foto será usada como capa no site.'
                )
                return
            }

            const { error } = await supabase
                .from('vehicles')
                .update({
                    main_photo_file_id: fileId,
                })
                .eq('id', editingVehicleId)

            if (error) {
                showToast('error', 'Erro', 'Não foi possível definir a foto principal.')
                return
            }

            showToast(
                'success',
                'Foto principal definida',
                'Essa foto será usada como capa no site.'
            )

            await loadVehicles()
        }

        async function handleTogglePublished() {
            if (status === 'VENDIDO' && !isPublished) {
                setPublishConfirmOpen(false)
                showToast(
                    'error',
                    'Não é possível publicar',
                    'Veículos vendidos não podem aparecer no site.'
                )
                return
            }

            const newValue = !isPublished

            setIsPublished(newValue)
            setPublishConfirmOpen(false)

            if (!editingVehicleId) {
                showToast(
                    'success',
                    newValue ? 'Marcado para publicar' : 'Marcado para despublicar',
                    'A alteração será aplicada quando você salvar o veículo.'
                )
                return
            }

            const { error } = await supabase
                .from('vehicles')
                .update({
                    is_published: newValue,
                })
                .eq('id', editingVehicleId)

            if (error) {
                setIsPublished(!newValue)
                showToast('error', 'Erro', 'Não foi possível alterar a publicação.')
                return
            }

            showToast(
                'success',
                newValue ? 'Veículo publicado' : 'Veículo despublicado',
                newValue
                    ? 'Este veículo agora aparece no site.'
                    : 'Este veículo foi removido do site.'
            )

            await loadVehicles()
        }
        return (
            <>
                <PageContainer
                    title="Veículos"
                    description="Controle de veículos da Matrix."
                    action={
                        <button
                            onClick={() => {
                                setShowForm(!showForm)
                                resetForm()
                            }}
                            className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-700"
                        >
                            {showForm ? 'Fechar formulário' : '+ Novo veículo'}
                        </button>
                    }
                >
                    {showForm && (
                        <div className="slide-up rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-xl shadow-zinc-200/60 backdrop-blur">
                            <h2 className="text-xl font-bold">
                                {editingVehicleId ? 'Editar veículo' : 'Cadastrar novo veículo'}
                            </h2>

                            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
                                <div>
                                    <label className="text-sm font-medium text-zinc-700">Placa</label>
                                    <input
                                        value={plate}
                                        onChange={(event) =>
                                            setPlate(
                                                event.target.value
                                                    .toUpperCase()
                                                    .replace(/\s/g, '')
                                                    .slice(0, 7)
                                            )
                                        }
                                        placeholder="ABC1D23"
                                        maxLength={7}
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">Marca</label>
                                    <select
                                        value={brandId}
                                        onChange={(event) => handleBrandChange(event.target.value)}
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    >
                                        <option value="">Selecione</option>
                                        {brands.map((brand) => (
                                            <option key={brand.id} value={brand.id}>
                                                {brand.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">Modelo</label>
                                    <select
                                        value={modelId}
                                        onChange={(event) => setModelId(event.target.value)}
                                        disabled={!brandId}
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10 disabled:bg-zinc-100 disabled:text-zinc-400"
                                    >
                                        <option value="">
                                            {brandId ? 'Selecione' : 'Selecione uma marca primeiro'}
                                        </option>
                                        {filteredModels.map((model) => (
                                            <option key={model.id} value={model.id}>
                                                {model.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>


                                <div>
                                    <label className="text-sm font-medium text-zinc-700">Categoria</label>
                                    <select
                                        value={categoryId}
                                        onChange={(event) => setCategoryId(event.target.value)}
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    >
                                        <option value="">Selecione</option>
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">Cor</label>
                                    <select
                                        value={colorId}
                                        onChange={(event) => setColorId(event.target.value)}
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    >
                                        <option value="">Selecione</option>
                                        {colors.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">Motor</label>
                                    <select
                                        value={engineId}
                                        onChange={(event) => setEngineId(event.target.value)}
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    >
                                        <option value="">Selecione</option>
                                        {engines.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">Câmbio</label>
                                    <select
                                        value={transmissionId}
                                        onChange={(event) => setTransmissionId(event.target.value)}
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    >
                                        <option value="">Selecione</option>
                                        {transmissions.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">
                                        Combustível
                                    </label>
                                    <select
                                        value={fuelId}
                                        onChange={(event) => setFuelId(event.target.value)}
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    >
                                        <option value="">Selecione</option>
                                        {fuels.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">
                                        Ano fabricação
                                    </label>
                                    <input
                                        type="number"
                                        value={manufactureYear}
                                        onChange={(event) => setManufactureYear(event.target.value)}
                                        placeholder="2020"
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">
                                        Ano modelo
                                    </label>
                                    <input
                                        type="number"
                                        value={modelYear}
                                        onChange={(event) => setModelYear(event.target.value)}
                                        placeholder="2021"
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">KM</label>
                                    <input
                                        type="number"
                                        value={km}
                                        onChange={(event) => setKm(event.target.value)}
                                        placeholder="45000"
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">Chassi</label>
                                    <input
                                        value={chassi}
                                        onChange={(event) => setChassi(formatChassi(event.target.value))}
                                        placeholder="9BWZZZ377VT004251"
                                        maxLength={17}
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 uppercase outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    />
                                    <p className="mt-1 text-xs text-zinc-400">
                                        {chassi.length}/17 caracteres
                                    </p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">Renavam</label>
                                    <input
                                        value={renavam}
                                        onChange={(event) => setRenavam(formatRenavam(event.target.value))}
                                        placeholder="12345678901"
                                        maxLength={11}
                                        inputMode="numeric"
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    />
                                    <p className="mt-1 text-xs text-zinc-400">
                                        {renavam.length}/11 dígitos
                                    </p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">
                                        Valor de compra
                                    </label>
                                    <CurrencyInput value={purchasePrice} onChange={setPurchasePrice} />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">
                                        Valor anunciado
                                    </label>
                                    <CurrencyInput
                                        value={advertisedPrice}
                                        onChange={setAdvertisedPrice}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-zinc-700">Status</label>
                                    <select
                                        value={status}
                                        onChange={(event) => {
                                            const newStatus = event.target.value

                                            setStatus(newStatus)

                                            if (newStatus === 'VENDIDO') {
                                                setIsPublished(false)
                                            }
                                        }}
                                        className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    >
                                        {statusOptions.map((item) => (
                                            <option key={item.value} value={item.value}>
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-zinc-700">
                                        Publicação no site
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => setPublishConfirmOpen(true)}
                                        className={`mt-2 flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 ${isPublished
                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                            : 'bg-zinc-950 text-white hover:bg-zinc-800'
                                            }`}
                                    >
                                        {isPublished ? 'Publicado no site' : 'Publicar no site'}
                                    </button>

                                    <p className="mt-1 text-xs text-zinc-500">
                                        {isPublished
                                            ? 'Este veículo aparece no site.'
                                            : 'Este veículo ainda não aparece no site.'}
                                    </p>
                                </div>
                                <div className="md:col-span-3">
                                    <label className="text-sm font-medium text-zinc-700">
                                        Observações
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(event) => setNotes(event.target.value)}
                                        placeholder="Ex: veículo revisado, manual e chave reserva, IPVA pago..."
                                        rows={4}
                                        className="mt-2 w-full resize-none rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                    />
                                </div>
                            </div>

                            <div className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                                    <div>
                                        <h3 className="text-lg font-bold text-zinc-950">
                                            Fotos e documentos
                                        </h3>
                                        <p className="mt-1 text-sm text-zinc-500">
                                            Anexe várias fotos e PDFs de uma vez. As fotos ficam separadas dos documentos.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-5 flex flex-wrap gap-3">
                                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700">
                                        <Upload size={18} />
                                        Enviar fotos
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            disabled={uploading}
                                            onChange={(event) => {
                                                const files = Array.from(event.target.files || [])
                                                event.target.value = ''

                                                files.forEach((file) => {
                                                    handleAddPendingFile(file, 'IMAGE')
                                                })
                                            }}
                                        />
                                    </label>

                                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800">
                                        <Upload size={18} />
                                        Enviar PDFs
                                        <input
                                            type="file"
                                            accept="application/pdf"
                                            multiple
                                            className="hidden"
                                            disabled={uploading}
                                            onChange={(event) => {
                                                const files = Array.from(event.target.files || [])
                                                event.target.value = ''

                                                files.forEach((file) => {
                                                    handleAddPendingFile(file, 'PDF')
                                                })
                                            }}
                                        />
                                    </label>
                                </div>

                                <div className="mt-8">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-base font-bold text-zinc-950">Fotos</h4>
                                            <p className="text-sm text-zinc-500">
                                                Escolha uma foto salva como principal do veículo.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
                                        {pendingImages.map((item) => (
                                            <div
                                                key={item.localId}
                                                className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50"
                                            >
                                                <div className="flex h-36 items-center justify-center bg-white text-amber-700">
                                                    <ImageIcon size={32} />
                                                </div>

                                                <div className="p-4">
                                                    <p className="truncate text-sm font-semibold text-zinc-950">
                                                        {item.file.name}
                                                    </p>
                                                    <p className="mt-1 text-xs text-amber-700">
                                                        Aguardando salvar · {formatFileSize(item.file.size)}
                                                    </p>

                                                    <button
                                                        onClick={() =>
                                                            setPendingFiles((current) =>
                                                                current.filter((file) => file.localId !== item.localId)
                                                            )
                                                        }
                                                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50"
                                                    >
                                                        <Trash2 size={16} />
                                                        Remover
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {savedImages.map((file) => {
                                            const isMainPhoto = editingVehicle?.main_photo_file_id === file.id

                                            return (
                                                <div
                                                    key={file.id}
                                                    className={`overflow-hidden rounded-2xl border bg-white ${isMainPhoto
                                                        ? 'border-red-300 ring-2 ring-red-100'
                                                        : 'border-zinc-200'
                                                        }`}
                                                >
                                                    <a
                                                        href={getPublicFileUrl(file)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="block"
                                                    >
                                                        <img
                                                            src={getPublicFileUrl(file)}
                                                            alt={file.file_name}
                                                            className="h-36 w-full object-cover"
                                                        />
                                                    </a>

                                                    <div className="p-4">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-semibold text-zinc-950">
                                                                    {file.file_name}
                                                                </p>
                                                                <p className="mt-1 text-xs text-zinc-500">
                                                                    Foto · {formatFileSize(file.file_size)}
                                                                </p>
                                                            </div>

                                                            {isMainPhoto && (
                                                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">
                                                                    <Star size={12} fill="currentColor" />
                                                                    Principal
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="mt-4 flex flex-wrap gap-2">
                                                            {!isMainPhoto && (
                                                                <button
                                                                    onClick={() => void handleSetMainPhoto(file.id)}
                                                                    className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-zinc-800"
                                                                >
                                                                    Definir principal
                                                                </button>
                                                            )}

                                                            <a
                                                                href={getPublicFileUrl(file)}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200"
                                                            >
                                                                Abrir
                                                            </a>

                                                            <button
                                                                onClick={() => setDeleteFile(file)}
                                                                className="rounded-xl bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}

                                        {pendingImages.length === 0 && savedImages.length === 0 && (
                                            <div className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-500 md:col-span-3 xl:col-span-4">
                                                Nenhuma foto anexada para este veículo.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-8">
                                    <div className="mb-4">
                                        <h4 className="text-base font-bold text-zinc-950">Documentos PDF</h4>
                                        <p className="text-sm text-zinc-500">
                                            CRLV, nota fiscal, laudo cautelar, contrato e outros documentos.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        {pendingDocuments.map((item) => (
                                            <div
                                                key={item.localId}
                                                className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700">
                                                        <FileText size={20} />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-zinc-950">
                                                            {item.file.name}
                                                        </p>
                                                        <p className="text-xs text-amber-700">
                                                            Aguardando salvar · {formatFileSize(item.file.size)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() =>
                                                        setPendingFiles((current) =>
                                                            current.filter((file) => file.localId !== item.localId)
                                                        )
                                                    }
                                                    className="rounded-xl bg-white p-2 text-red-600 transition hover:bg-red-50"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        ))}

                                        {savedDocuments.map((file) => (
                                            <div
                                                key={file.id}
                                                className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                                                        <FileText size={20} />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-zinc-950">
                                                            {file.file_name}
                                                        </p>
                                                        <p className="text-xs text-zinc-500">
                                                            PDF · {formatFileSize(file.file_size)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex shrink-0 gap-2">
                                                    <a
                                                        href={getPublicFileUrl(file)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200"
                                                    >
                                                        Abrir
                                                    </a>

                                                    <button
                                                        onClick={() => setDeleteFile(file)}
                                                        className="rounded-xl bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {pendingDocuments.length === 0 && savedDocuments.length === 0 && (
                                            <div className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-500">
                                                Nenhum documento PDF anexado para este veículo.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <button
                                    onClick={handleSaveVehicle}
                                    disabled={loading || uploading}
                                    className="rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 disabled:opacity-50"
                                >
                                    {loading || uploading
                                        ? 'Salvando...'
                                        : editingVehicleId
                                            ? 'Salvar edição'
                                            : 'Salvar veículo'}
                                </button>

                                {editingVehicleId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            resetForm()
                                            setShowForm(false)
                                        }}
                                        className="rounded-xl bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200"
                                    >
                                        Fechar formulário
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/40">
                            <p className="text-sm text-zinc-500">Publicados no site</p>
                            <strong className="mt-2 block text-3xl text-emerald-700">
                                {publishedVehiclesCount}
                            </strong>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/40 md:grid-cols-4">
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium text-zinc-700">
                                Buscar veículo
                            </label>

                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Buscar por placa, marca, modelo, cor, chassi ou renavam..."
                                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-zinc-700">Status</label>

                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                            >
                                <option value="">Todos</option>

                                {statusOptions.map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-zinc-700">
                                Publicação
                            </label>

                            <select
                                value={publishedFilter}
                                onChange={(event) => setPublishedFilter(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                            >
                                <option value="">Todos</option>
                                <option value="PUBLICADO">Publicados</option>
                                <option value="NAO_PUBLICADO">Não publicados</option>
                            </select>
                        </div>
                    </div>

                    <div className="fade-in mt-8 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-950 text-white">
                                <tr>
                                    <th className="px-5 py-4 text-left">Placa</th>
                                    <th className="px-5 py-4 text-left">Marca</th>
                                    <th className="px-5 py-4 text-left">Modelo</th>
                                    <th className="px-5 py-4 text-left">Categoria</th>
                                    <th className="px-5 py-4 text-left">Cor</th>
                                    <th className="px-5 py-4 text-left">Ano</th>
                                    <th className="px-5 py-4 text-left">KM</th>
                                    <th className="px-5 py-4 text-left">Anunciado</th>
                                    <th className="px-5 py-4 text-left">Site</th>
                                    <th className="px-5 py-4 text-left">Status</th>
                                    <th className="px-5 py-4 text-right">Ações</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredVehicles.map((vehicle) => (
                                    <tr
                                        key={vehicle.id}
                                        className="border-t transition-colors duration-200 hover:bg-zinc-50"
                                    >
                                        <td className="px-5 py-4 font-semibold">{vehicle.plate}</td>
                                        <td className="px-5 py-4">{vehicle.brands?.name || '-'}</td>
                                        <td className="px-5 py-4">{vehicle.vehicle_models?.name || '-'}</td>
                                        <td className="px-5 py-4">{vehicle.vehicle_categories?.name || '-'}</td>
                                        <td className="px-5 py-4">{vehicle.colors?.name || '-'}</td>
                                        <td className="px-5 py-4">
                                            {vehicle.manufacture_year || '-'}
                                            {vehicle.model_year ? `/${vehicle.model_year}` : ''}
                                        </td>
                                        <td className="px-5 py-4">
                                            {vehicle.km ? `${vehicle.km.toLocaleString('pt-BR')} km` : '-'}
                                        </td>

                                        <td className="px-5 py-4">
                                            {formatCurrency(Number(vehicle.advertised_price || 0))}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-bold ${vehicle.is_published
                                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                                    : 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200'
                                                    }`}
                                            >
                                                {vehicle.is_published ? 'Publicado' : 'Não publicado'}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4">
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                                                    vehicle.status
                                                )}`}
                                            >
                                                {getStatusLabel(vehicle.status)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex justify-end gap-2">
                                                <Link
                                                    href={`/veiculos/${vehicle.id}`}
                                                    className="rounded-xl bg-zinc-100 p-2 text-zinc-700 transition hover:bg-zinc-200"
                                                    title="Visualizar"
                                                >
                                                    <Eye size={18} />
                                                </Link>

                                                <button
                                                    onClick={() => handleEditVehicle(vehicle)}
                                                    className="rounded-xl bg-zinc-100 p-2 text-zinc-700 transition hover:bg-zinc-200"
                                                    title="Editar"
                                                >
                                                    <Pencil size={18} />
                                                </button>

                                                <button
                                                    onClick={() => setDeleteVehicleId(vehicle.id)}
                                                    className="rounded-xl bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {filteredVehicles.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={14}
                                            className="px-5 py-10 text-center text-zinc-500"
                                        >
                                            Nenhum veículo cadastrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </PageContainer>

                <ConfirmDialog
                    open={!!deleteVehicleId}
                    title="Excluir veículo"
                    description="Deseja realmente excluir este veículo? Essa ação não poderá ser desfeita."
                    confirmText="Excluir veículo"
                    loading={deleteLoading}
                    onCancel={() => setDeleteVehicleId(null)}
                    onConfirm={handleDeleteVehicle}
                />

                <ConfirmDialog
                    open={!!deleteFile}
                    title="Excluir arquivo"
                    description="Deseja realmente excluir este arquivo?"
                    confirmText="Excluir arquivo"
                    loading={deleteFileLoading}
                    onCancel={() => setDeleteFile(null)}
                    onConfirm={handleDeleteFile}
                />

                <ConfirmDialog
                    open={publishConfirmOpen}
                    title={isPublished ? 'Despublicar veículo' : 'Publicar veículo'}
                    description={
                        isPublished
                            ? 'Deseja realmente remover este veículo do site? Ele continuará salvo no sistema.'
                            : 'Deseja realmente publicar este veículo no site? Ele ficará visível para os visitantes.'
                    }
                    confirmText={isPublished ? 'Despublicar' : 'Publicar'}
                    loading={false}
                    onCancel={() => setPublishConfirmOpen(false)}
                    onConfirm={handleTogglePublished}
                />
                <Toast
                    open={toast.open}
                    type={toast.type}
                    title={toast.title}
                    description={toast.description}
                    onClose={() => setToast((current) => ({ ...current, open: false }))}
                />
            </>
        )
    }